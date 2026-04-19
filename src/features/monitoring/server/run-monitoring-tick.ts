import { createRepositories } from "@/server/repositories";
import { draftIntervention } from "@/features/monitoring/server/draft-intervention";

function mapScenarioToTrigger(scenario: string) {
  switch (scenario) {
    case "breakdown":
      return "long_idle" as const;
    case "route_deviation":
      return "route_deviation" as const;
    case "eta_slip":
      return "eta_slip" as const;
    default:
      return null;
  }
}

export async function runMonitoringTick() {
  const repositories = createRepositories();
  // Self-healing sweep: clean up any leftover duplicate open drafts for the
  // same trip before we read the current open list. This fixes drift that
  // may have been written by older code paths or a race between ticks.
  await repositories.interventionDrafts.pruneDuplicateOpenDrafts();

  const trips = await repositories.activeTripMirror.listAll();
  const [existingDrafts, resolvedTripIds] = await Promise.all([
    repositories.interventionDrafts.listRecentOpen(),
    repositories.interventionDrafts.listResolvedTripIds()
  ]);
  // One open alert per trip at a time. Previously we deduped on
  // (tripId, trigger), but `draftIntervention` rewrites the stored trigger
  // for some trips (e.g. TRIP-ACT3 is always saved as `long_idle`), so
  // switching scenarios on the same trip could stack up multiple
  // identical-looking open alerts for the same tripId.
  const openTripIds = new Set(existingDrafts.map((draft) => draft.tripId));
  // Once a dispatcher has executed an intervention on a trip, treat that
  // trip as resolved for the rest of the session. We don't re-alert on the
  // same trip even if a new scenario fires. The `executedAt` timestamp on
  // the draft is the persistence anchor — it gets wiped by
  // `clearDemoPersistence` on app restart, which re-arms the alerts.
  const suppressedTripIds = new Set(resolvedTripIds);
  let interventionsCreated = 0;

  for (const trip of trips) {
    const trigger =
      mapScenarioToTrigger(trip.scenarioOverride ?? "") ??
      (trip.status !== "on_track" ? (trip.status as "route_deviation" | "long_idle" | "hos_risk" | "eta_slip") : null);

    if (!trigger) {
      continue;
    }

    if (openTripIds.has(trip.tripId) || suppressedTripIds.has(trip.tripId)) {
      continue;
    }

    const intervention = await draftIntervention({ tripId: trip.tripId, trigger });
    await repositories.interventionDrafts.create(intervention);
    openTripIds.add(trip.tripId);
    await repositories.decisionLog.append({
      actionType: "intervention_drafted",
      summary: `Intervention drafted for ${trip.tripId}.`,
      mathSummary: intervention.relayDistanceMi ? `Relay driver ${intervention.relayDriverName} is ${intervention.relayDistanceMi} miles away.` : undefined,
      outcome: trigger,
      tripId: trip.tripId,
      driverId: intervention.relayDriverId ?? undefined,
      entityType: "intervention",
      source: "monitor"
    });
    interventionsCreated += 1;
  }

  return { interventionsCreated };
}
