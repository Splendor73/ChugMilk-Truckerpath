import { getSyntheticBreakdownScript } from "@/server/integrations/navpro-synthetic";
import type { InterventionDraft } from "@/shared/contracts";
import { getFleetSnapshot } from "@/features/fleet/server/get-fleet-snapshot";
import { haversineMiles } from "@/shared/utils/geo";
import { nowMs } from "@/shared/utils/time";

export async function draftIntervention(input: {
  tripId: string;
  trigger: InterventionDraft["trigger"];
}): Promise<InterventionDraft> {
  const snapshot = await getFleetSnapshot();
  const trip = snapshot.activeTrips.find((item) => item.tripId === input.tripId);
  const target = trip?.currentLoc ?? { lat: 34.8958, lng: -117.0228 };
  const relay = snapshot.drivers
    .filter((driver) => driver.driverId !== 104 && driver.hosRemainingMin >= 240)
    .map((driver) => ({
      driver,
      distance: haversineMiles(driver.currentLocation.lat, driver.currentLocation.lng, target.lat, target.lng)
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  if (input.tripId === "TRIP-ACT3" || input.trigger === "long_idle") {
    return {
      tripId: input.tripId,
      trigger: "long_idle",
      customerSms:
        "Truck 14 has been delayed near Barstow. Revised ETA is approximately 3 hours later than planned. We are dispatching a relay and will keep you updated.",
      relayDriverId: relay?.driver.driverId ?? 103,
      relayDriverName: relay?.driver.name ?? "Kevin Walsh",
      relayDistanceMi: relay ? Math.round(relay.distance) : 28,
      rerouteNeeded: true,
      voiceScript: getSyntheticBreakdownScript(),
      createdAtMs: nowMs()
    };
  }

  return {
    tripId: input.tripId,
    trigger: input.trigger,
    customerSms: "Potential trip risk detected. Reviewing ETA and relay options now.",
    relayDriverId: relay?.driver.driverId ?? null,
    relayDriverName: relay?.driver.name ?? null,
    relayDistanceMi: relay ? Math.round(relay.distance) : null,
    rerouteNeeded: true,
    voiceScript: `Maria, trip ${input.tripId} has a ${input.trigger.replace(/_/g, " ")} risk. Review the drafted intervention before approving.`,
    createdAtMs: nowMs()
  };
}
