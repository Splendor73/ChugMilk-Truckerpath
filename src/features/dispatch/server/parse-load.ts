import type { Load } from "@/shared/contracts";
import { findCityCoordinates } from "@/shared/utils/geo";
import { findLoadById, listLoads } from "@/server/core/load-board";

const CITY_ALIASES: Record<string, { city: string; state: string }> = {
  PHX: { city: "Phoenix", state: "AZ" },
  PHOENIX: { city: "Phoenix", state: "AZ" },
  SFO: { city: "San Francisco", state: "CA" },
  "SAN FRANCISCO": { city: "San Francisco", state: "CA" },
  VEGAS: { city: "Las Vegas", state: "NV" },
  "LAS VEGAS": { city: "Las Vegas", state: "NV" }
};

const LOCATION_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "broker",
  "confirmation",
  "customer",
  "delivery",
  "dry",
  "email",
  "for",
  "freight",
  "general",
  "load",
  "need",
  "pickup",
  "rate",
  "the",
  "today",
  "tomorrow",
  "van",
  "weight",
  "window"
]);

type LocationCandidate = {
  phrase: string;
  city: string;
  state: string;
};

const LOCATION_CANDIDATES: LocationCandidate[] = (() => {
  const unique = new Map<string, LocationCandidate>();

  for (const alias of Object.keys(CITY_ALIASES)) {
    const resolved = CITY_ALIASES[alias];
    unique.set(`${resolved.city}-${resolved.state}-${alias}`, {
      phrase: alias.toLowerCase(),
      city: resolved.city,
      state: resolved.state
    });
  }

  for (const load of listLoads()) {
    unique.set(`${load.origin.city}-${load.origin.state}-origin`, {
      phrase: load.origin.city.toLowerCase(),
      city: load.origin.city,
      state: load.origin.state
    });
    unique.set(`${load.destination.city}-${load.destination.state}-destination`, {
      phrase: load.destination.city.toLowerCase(),
      city: load.destination.city,
      state: load.destination.state
    });
  }

  return [...unique.values()].sort((left, right) => right.phrase.length - left.phrase.length);
})();

function parseAmount(input: string, regex: RegExp, fallback?: number) {
  const match = input.match(regex);
  if (!match) {
    return fallback;
  }
  return Number(match[1].replace(/,/g, ""));
}

function parseLocation(token: string) {
  const normalized = token.trim().toUpperCase();
  const alias = CITY_ALIASES[normalized];
  if (alias) {
    const coords = findCityCoordinates(alias.city, alias.state);
    if (coords) {
      return coords;
    }
  }

  const words = token.trim();
  const coords = findCityCoordinates(words);
  return coords;
}

function cleanLocationToken(token: string) {
  let cleaned = token
    .replace(/[.,/#!$%^&*;:{}=_`~()|?<>[\]\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);
  while (words.length > 1 && LOCATION_STOP_WORDS.has(words[0].toLowerCase())) {
    words.shift();
  }
  while (words.length > 1 && LOCATION_STOP_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }

  cleaned = words.join(" ").trim();
  return cleaned;
}

function resolveLocationToken(token: string) {
  const cleaned = cleanLocationToken(token);
  if (!cleaned) {
    return null;
  }

  const direct = parseLocation(cleaned);
  if (direct) {
    return direct;
  }

  const lowered = ` ${cleaned.toLowerCase()} `;
  for (const candidate of LOCATION_CANDIDATES) {
    if (!lowered.includes(` ${candidate.phrase} `) && lowered.trim() !== candidate.phrase) {
      continue;
    }
    const coords = findCityCoordinates(candidate.city, candidate.state);
    if (coords) {
      return coords;
    }
  }

  return null;
}

function extractRouteLocations(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  const patterns = [
    /\bfrom\s+(.+?)\s+to\s+(.+?)(?=(?:\s+(?:for|pickup|delivery|rate|weight|commodity|customer|tomorrow|today)\b|[.,;]|$))/i,
    /\b(.+?)\s+to\s+(.+?)(?=(?:\s+(?:for|pickup|delivery|rate|weight|commodity|customer|tomorrow|today)\b|[.,;]|$))/i
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match) {
      continue;
    }

    const origin = resolveLocationToken(match[1]);
    const destination = resolveLocationToken(match[2]);
    if (origin && destination) {
      return { origin, destination };
    }
  }

  const mentions = LOCATION_CANDIDATES.flatMap((candidate) => {
    const lowered = compact.toLowerCase();
    const index = lowered.indexOf(candidate.phrase);
    if (index === -1) {
      return [];
    }
    const coords = findCityCoordinates(candidate.city, candidate.state);
    if (!coords) {
      return [];
    }
    return [
      {
        start: index,
        phrase: candidate.phrase,
        coords
      }
    ];
  }).sort((left, right) => left.start - right.start || right.phrase.length - left.phrase.length);

  const distinct = mentions.filter(
    (mention, index) =>
      mentions.findIndex(
        (candidate) =>
          candidate.coords.city === mention.coords.city && candidate.coords.state === mention.coords.state
      ) === index
  );

  if (distinct.length >= 2) {
    return {
      origin: distinct[0].coords,
      destination: distinct[1].coords
    };
  }

  return null;
}

function parsePickupWindow(message: string) {
  const lower = message.toLowerCase();
  const now = new Date();
  const pickup = new Date(now);
  if (lower.includes("tomorrow")) {
    pickup.setDate(pickup.getDate() + 1);
  }
  const hourMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (hourMatch) {
    let hours = Number(hourMatch[1]);
    const minutes = Number(hourMatch[2] ?? 0);
    const meridiem = hourMatch[3];
    if (meridiem === "pm" && hours !== 12) {
      hours += 12;
    }
    if (meridiem === "am" && hours === 12) {
      hours = 0;
    }
    pickup.setHours(hours, minutes, 0, 0);
  } else {
    pickup.setHours(9, 0, 0, 0);
  }
  const pickupEnd = new Date(pickup);
  pickupEnd.setHours(pickupEnd.getHours() + 4);
  return { pickupStartMs: pickup.getTime(), pickupEndMs: pickupEnd.getTime() };
}

export async function parseLoadInput(input: { userMessage: string }): Promise<Load> {
  const message = input.userMessage.trim();
  const lower = message.toLowerCase();
  const demoMatch =
    lower.includes("phx to sfo") ||
    (lower.includes("phoenix") && lower.includes("san francisco") && lower.includes("3200"));
  if (demoMatch) {
    const demo = findLoadById("TL-DEMO-01");
    if (demo) {
      return { ...demo, source: "paste" };
    }
  }

  const route = extractRouteLocations(message);
  const originCoords = route?.origin ?? parseLocation("Phoenix");
  const destinationCoords = route?.destination ?? parseLocation("San Francisco");

  if (!originCoords || !destinationCoords) {
    throw new Error("Could not resolve origin/destination from pasted load.");
  }

  const rateUsd = parseAmount(message, /\$([\d,]+)/, 2000) ?? 2000;
  const weightLbs = parseAmount(message, /([\d,]+)\s*(?:lbs|lb)/i, undefined);
  const { pickupStartMs, pickupEndMs } = parsePickupWindow(message);

  const matchedSeed = listLoads().find(
    (load) =>
      load.origin.city === originCoords.city &&
      load.destination.city === destinationCoords.city &&
      Math.abs(load.rateUsd - rateUsd) < 50
  );

  if (matchedSeed) {
    return { ...matchedSeed, source: "paste" };
  }

  return {
    loadId: `PASTE-${originCoords.state}-${destinationCoords.state}-${pickupStartMs}`,
    source: "paste",
    origin: {
      city: originCoords.city,
      state: originCoords.state,
      lat: originCoords.lat,
      lng: originCoords.lng
    },
    destination: {
      city: destinationCoords.city,
      state: destinationCoords.state,
      lat: destinationCoords.lat,
      lng: destinationCoords.lng
    },
    pickupStartMs,
    pickupEndMs,
    rateUsd,
    weightLbs,
    commodity: lower.includes("dry van") ? "General Freight" : undefined,
    customer: "Broker Load"
  };
}
