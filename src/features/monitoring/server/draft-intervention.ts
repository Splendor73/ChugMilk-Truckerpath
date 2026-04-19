import { getSyntheticBreakdownScript } from "@/server/integrations/navpro-synthetic";
import type { InterventionDraft } from "@/shared/contracts";
import { getFleetSnapshot } from "@/features/fleet/server/get-fleet-snapshot";
import { haversineMiles } from "@/shared/utils/geo";
import { nowMs } from "@/shared/utils/time";

// The demo intentionally ships with two distinct alert "voices" so the
// dispatcher can see on day one that the AI-generated copy is not a
// single hard-coded template:
//
//   - Style A — ops / factual: short, operations-first language aimed at
//     the dispatcher. Used for breakdown + long_idle triggers.
//   - Style B — customer-care / conversational: warmer, apology-led copy
//     aimed at the broker/consignee. Used for eta_slip.
//
// The fallback block handles route_deviation / hos_risk with a middle
// tone that's still action-oriented but less scripted than Style A.

type RelayChoice = {
  driverId: number;
  driverName: string;
  distanceMi: number;
};

function pickRelay(snapshot: Awaited<ReturnType<typeof getFleetSnapshot>>, trip: { driverId: number; currentLoc: { lat: number; lng: number } } | undefined): RelayChoice | null {
  const target = trip?.currentLoc ?? { lat: 34.8958, lng: -117.0228 };
  const excludeDriverId = trip?.driverId;
  const relay = snapshot.drivers
    .filter((driver) => driver.driverId !== excludeDriverId && driver.hosRemainingMin >= 240)
    .map((driver) => ({
      driver,
      distance: haversineMiles(driver.currentLocation.lat, driver.currentLocation.lng, target.lat, target.lng)
    }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (!relay) {
    return null;
  }
  return {
    driverId: relay.driver.driverId,
    driverName: relay.driver.name,
    distanceMi: Math.round(relay.distance)
  };
}

function minutesBehind(etaMs: number | undefined) {
  if (!etaMs) {
    return null;
  }
  const delta = Math.round((etaMs - nowMs()) / 60000);
  return delta > 0 ? delta : null;
}

export async function draftIntervention(input: {
  tripId: string;
  trigger: InterventionDraft["trigger"];
}): Promise<InterventionDraft> {
  const snapshot = await getFleetSnapshot();
  const trip = snapshot.activeTrips.find((item) => item.tripId === input.tripId);
  const relay = pickRelay(snapshot, trip ? { driverId: trip.driverId, currentLoc: trip.currentLoc } : undefined);

  // ---- Style A — ops / factual (breakdown + long idle) ----
  if (input.tripId === "TRIP-ACT3" || input.trigger === "long_idle") {
    return {
      tripId: input.tripId,
      trigger: input.trigger,
      customerSms:
        "Truck 14 has been delayed near Barstow. Revised ETA is approximately 3 hours later than planned. We are dispatching a relay and will keep you updated.",
      relayDriverId: relay?.driverId ?? 103,
      relayDriverName: relay?.driverName ?? "Kevin Walsh",
      relayDistanceMi: relay?.distanceMi ?? 28,
      rerouteNeeded: true,
      voiceScript: getSyntheticBreakdownScript(),
      createdAtMs: nowMs()
    };
  }

  // ---- Style B — customer-care / conversational (ETA slip) ----
  if (input.trigger === "eta_slip") {
    const delayMin = minutesBehind(trip?.etaMs) ?? 120;
    const delayLabel = delayMin >= 60
      ? `${Math.round(delayMin / 60)} hr${Math.round(delayMin / 60) === 1 ? "" : "s"}`
      : `${delayMin} min`;
    const destinationLabel = trip?.destination
      ? `${trip.destination.city}, ${trip.destination.state}`
      : "destination";
    const relaySentence = relay
      ? `If we need to swap, ${relay.driverName} is only ${relay.distanceMi} miles out and can cover the drop.`
      : "No relay needed yet — the driver is still rolling, just behind schedule.";
    return {
      tripId: input.tripId,
      trigger: input.trigger,
      customerSms:
        `Quick heads-up: your ${destinationLabel} load is running about ${delayLabel} behind due to traffic. ` +
        "We're watching it closely and will call the moment the ETA firms up. Thanks for your patience.",
      relayDriverId: relay?.driverId ?? null,
      relayDriverName: relay?.driverName ?? null,
      relayDistanceMi: relay?.distanceMi ?? null,
      rerouteNeeded: false,
      voiceScript:
        `Hey Maria, trip ${input.tripId} is slipping about ${delayLabel} on the ${destinationLabel} run. ` +
        "I've drafted a friendly customer update that leads with the delay and ends with a promise to recheck. " +
        `${relaySentence} Want me to send the text and flag this one on the board?`,
      createdAtMs: nowMs()
    };
  }

  // ---- Fallback — neutral ops prompt (route_deviation, hos_risk, etc.) ----
  const triggerLabel = input.trigger.replace(/_/g, " ");
  return {
    tripId: input.tripId,
    trigger: input.trigger,
    customerSms: `Heads up — trip ${input.tripId} is flagged for ${triggerLabel}. Reviewing ETA and relay options now, updated details to follow.`,
    relayDriverId: relay?.driverId ?? null,
    relayDriverName: relay?.driverName ?? null,
    relayDistanceMi: relay?.distanceMi ?? null,
    rerouteNeeded: true,
    voiceScript:
      `Maria, trip ${input.tripId} is showing a ${triggerLabel} risk. ` +
      `${relay ? `${relay.driverName} is ${relay.distanceMi} miles away with HOS to cover it. ` : ""}` +
      "Review the drafted intervention before approving.",
    createdAtMs: nowMs()
  };
}
