import { getServerEnv } from "@/config/env.server";
import { callLLM } from "@/features/copilot/server/call-llm";
import type { Load } from "@/shared/contracts";
import { findCityCoordinates } from "@/shared/utils/geo";
import { findLoadById, listLoads } from "@/server/core/load-board";

const CITY_ALIASES: Record<string, { city: string; state: string }> = {
  PHX: { city: "Phoenix", state: "AZ" },
  PHOENIX: { city: "Phoenix", state: "AZ" },
  DEN: { city: "Denver", state: "CO" },
  DENVER: { city: "Denver", state: "CO" },
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

type LLMExtractedLoad = {
  originCity: string | null;
  originState: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  pickupDayOffset: number | null;
  pickupHour24: number | null;
  pickupMinute: number | null;
  pickupWindowHours: number | null;
  rateUsd: number | null;
  weightLbs: number | null;
  commodity: string | null;
  customer: string | null;
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

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }

  throw new Error("LLM load extraction did not return JSON.");
}

function parseLLMExtraction(raw: string): LLMExtractedLoad | null {
  const json = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;

  return {
    originCity: toNullableString(json.origin_city),
    originState: toNullableString(json.origin_state),
    destinationCity: toNullableString(json.destination_city),
    destinationState: toNullableString(json.destination_state),
    pickupDayOffset: toNullableNumber(json.pickup_day_offset),
    pickupHour24: toNullableNumber(json.pickup_hour_24),
    pickupMinute: toNullableNumber(json.pickup_minute),
    pickupWindowHours: toNullableNumber(json.pickup_window_hours),
    rateUsd: toNullableNumber(json.rate_usd),
    weightLbs: toNullableNumber(json.weight_lbs),
    commodity: toNullableString(json.commodity),
    customer: toNullableString(json.customer)
  };
}

function hasConfiguredLoadExtractionModel() {
  const env = getServerEnv();
  return Boolean(env.GROQ_API_KEY || env.GEMINI_API_KEY);
}

async function extractLoadWithLLM(message: string): Promise<LLMExtractedLoad | null> {
  if (!hasConfiguredLoadExtractionModel()) {
    return null;
  }

  const env = getServerEnv();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const response = await callLLM(
      [
        {
          role: "system",
          content:
            "Extract structured trucking load fields from broker text. Respond with JSON only. " +
            "Use null for missing fields. Keep city names normalized and states as 2-letter abbreviations when known. " +
            "pickup_day_offset is 0 for today, 1 for tomorrow, 2 for day after tomorrow. " +
            "pickup_hour_24 uses 24-hour time and pickup_window_hours is the window length."
        },
        {
          role: "user",
          content:
            `Today is ${today}. Extract this load into JSON with keys ` +
            "{origin_city, origin_state, destination_city, destination_state, pickup_day_offset, pickup_hour_24, pickup_minute, pickup_window_hours, rate_usd, weight_lbs, commodity, customer}. " +
            `Text: ${message}`
        }
      ],
      undefined,
      {
        model: env.GROQ_API_KEY ? "groq" : "gemini"
      }
    );

    return parseLLMExtraction(response.content);
  } catch {
    return null;
  }
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

function resolveExtractedLocation(city: string | null, state: string | null) {
  if (!city) {
    return null;
  }

  const direct = state ? findCityCoordinates(city, state) : findCityCoordinates(city);
  if (direct) {
    return direct;
  }

  return parseLocation(state ? `${city} ${state}` : city);
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

    return {
      originToken: cleanLocationToken(match[1]),
      destinationToken: cleanLocationToken(match[2]),
      origin: resolveLocationToken(match[1]),
      destination: resolveLocationToken(match[2]),
      explicitRoute: true as const
    };
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
      originToken: distinct[0].coords.city,
      destinationToken: distinct[1].coords.city,
      origin: distinct[0].coords,
      destination: distinct[1].coords,
      explicitRoute: false as const
    };
  }

  return null;
}

function parsePickupWindow(message: string, extracted?: LLMExtractedLoad | null) {
  const lower = message.toLowerCase();
  const now = new Date();
  const pickup = new Date(now);
  pickup.setDate(
    pickup.getDate() + (typeof extracted?.pickupDayOffset === "number" ? extracted.pickupDayOffset : lower.includes("tomorrow") ? 1 : 0)
  );

  if (typeof extracted?.pickupHour24 === "number") {
    pickup.setHours(extracted.pickupHour24, extracted.pickupMinute ?? 0, 0, 0);
  } else {
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
  }

  const pickupEnd = new Date(pickup);
  pickupEnd.setHours(pickupEnd.getHours() + (extracted?.pickupWindowHours && extracted.pickupWindowHours > 0 ? extracted.pickupWindowHours : 4));
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

  const llmExtraction = await extractLoadWithLLM(message);
  const route = extractRouteLocations(message);
  const llmOrigin = resolveExtractedLocation(llmExtraction?.originCity ?? null, llmExtraction?.originState ?? null);
  const llmDestination = resolveExtractedLocation(llmExtraction?.destinationCity ?? null, llmExtraction?.destinationState ?? null);

  const unresolvedLLMLocations = [
    llmExtraction?.originCity && !llmOrigin ? llmExtraction.originCity : null,
    llmExtraction?.destinationCity && !llmDestination ? llmExtraction.destinationCity : null
  ].filter((token): token is string => Boolean(token));

  if (unresolvedLLMLocations.length > 0) {
    throw new Error(`Could not resolve ${unresolvedLLMLocations.join(" and ")} from pasted load.`);
  }

  if (route?.explicitRoute && (!route.origin || !route.destination)) {
    const unresolved = [
      !route.origin ? route.originToken : null,
      !route.destination ? route.destinationToken : null
    ].filter((token): token is string => Boolean(token));

    throw new Error(`Could not resolve ${unresolved.join(" and ")} from pasted load.`);
  }

  const originCoords = llmOrigin ?? route?.origin ?? parseLocation("Phoenix");
  const destinationCoords = llmDestination ?? route?.destination ?? parseLocation("San Francisco");

  if (!originCoords || !destinationCoords) {
    throw new Error("Could not resolve origin/destination from pasted load.");
  }

  const rateUsd = llmExtraction?.rateUsd ?? parseAmount(message, /\$([\d,]+)/, 2000) ?? 2000;
  const weightLbs = llmExtraction?.weightLbs ?? parseAmount(message, /([\d,]+)\s*(?:lbs|lb)/i, undefined);
  const { pickupStartMs, pickupEndMs } = parsePickupWindow(message, llmExtraction);

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
    commodity: llmExtraction?.commodity ?? (lower.includes("dry van") ? "General Freight" : undefined),
    customer: llmExtraction?.customer ?? "Broker Load"
  };
}
