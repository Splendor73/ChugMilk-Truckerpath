import { createRepositories } from "@/server/repositories";
import { devSimulateRequestSchema } from "@/shared/schemas/contracts";
import { fail, ok, readJson } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { resetDemoState } from "@/features/demo/server/reset-demo-state";
import { controlNavProScenario, queryTrips } from "@/server/integrations/navpro";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureDemoRuntimeReady();
    const input = await readJson(request, devSimulateRequestSchema);
    if (input.action === "reset") {
      await resetDemoState();
      return ok({ ok: true as const });
    }

    const repositories = createRepositories();
    controlNavProScenario({
      action: input.action ?? (input.tripId && input.scenario ? "trigger_trip" : undefined),
      stage: input.stage,
      freezeHeroValues: input.freezeHeroValues,
      tripId: input.tripId,
      scenario: input.scenario
    });
    const tripsResponse = await queryTrips();
    const liveRows = Array.isArray(tripsResponse.data) ? tripsResponse.data : [];
    if (input.tripId && input.scenario) {
      const existing = await repositories.activeTripMirror.findByTripId(input.tripId);
      if (!existing) {
        const trip = liveRows.find((item: any) => String(item.trip_id) === input.tripId);
        if (trip) {
          await repositories.activeTripMirror.upsertMany([
            {
              tripId: String(trip.trip_id),
              driverId: Number(trip.driver_id),
              loadId: String(trip.load_id ?? "unknown-load"),
              currentLoc: {
                lat: Number(trip.current_lat ?? 33.4484),
                lng: Number(trip.current_lng ?? -112.074)
              },
              etaMs: Number(trip.eta_ms ?? Date.now() + 2 * 60 * 60 * 1000),
              status: (trip.status as "on_track" | "route_deviation" | "long_idle" | "hos_risk" | "eta_slip") ?? "on_track",
              plannedRoute: Array.isArray(trip.planned_route) ? trip.planned_route : []
            }
          ]);
        }
      }
      await repositories.activeTripMirror.setScenarioOverride(input.tripId, input.scenario);
    }
    return ok({ ok: true as const });
  } catch (error) {
    return fail(error);
  }
}
