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
  const trips = await repositories.activeTripMirror.listAll();
  const existingDrafts = await repositories.interventionDrafts.listRecentOpen();
  let interventionsCreated = 0;

  for (const trip of trips) {
    const trigger =
      mapScenarioToTrigger(trip.scenarioOverride ?? "") ??
      (trip.status !== "on_track" ? (trip.status as "route_deviation" | "long_idle" | "hos_risk" | "eta_slip") : null);

    if (!trigger) {
      continue;
    }

    const alreadyOpen = existingDrafts.find(
      (draft: Awaited<ReturnType<typeof repositories.interventionDrafts.listRecentOpen>>[number]) =>
        draft.tripId === trip.tripId && draft.trigger === trigger
    );
    if (alreadyOpen) {
      continue;
    }

    const intervention = await draftIntervention({ tripId: trip.tripId, trigger });
    await repositories.interventionDrafts.create(intervention);
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
