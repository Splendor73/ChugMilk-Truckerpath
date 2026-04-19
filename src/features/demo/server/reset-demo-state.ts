import type { ActiveTrip } from "@/shared/contracts";
import { createRepositories } from "@/server/repositories";
import { getDb } from "@/server/db/client";
import { queryTrips, resetNavProScenario } from "@/server/integrations/navpro";
import { nowMs } from "@/shared/utils/time";

export async function clearDemoPersistence() {
  const db = getDb();

  await db.engineShowcaseDriver.deleteMany();
  await db.engineShowcaseScenario.deleteMany();
  await db.interventionDraft.deleteMany();
  await db.activeTripMirror.deleteMany();
  await db.loadAssignment.deleteMany();
  await db.decisionLog.deleteMany();

  resetNavProScenario();
}

// Pulls the baseline trip list from the (synthetic) NavPro source once and
// writes it into the ActiveTripMirror. After this seed runs, the mirror is
// the session source of truth — edits and deletions done through the route
// desk API will stick until the process is restarted and `clearDemoPersistence`
// runs again.
export async function seedActiveTripMirrorFromLive(): Promise<number> {
  const repositories = createRepositories();
  let response: Awaited<ReturnType<typeof queryTrips>>;
  try {
    response = await queryTrips();
  } catch {
    return 0;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  const trips: ActiveTrip[] = rows.flatMap((trip: any) => {
    if (!trip?.trip_id || trip.driver_id === undefined || trip.driver_id === null) {
      return [];
    }
    return [
      {
        tripId: String(trip.trip_id),
        driverId: Number(trip.driver_id),
        loadId: String(trip.load_id ?? trip.reference_number ?? "unknown-load"),
        currentLoc: {
          lat: Number(trip.current_lat ?? trip.lat ?? 33.4484),
          lng: Number(trip.current_lng ?? trip.lng ?? -112.074)
        },
        etaMs: Number(trip.eta_ms ?? (trip.eta ? new Date(trip.eta).getTime() : nowMs() + 2 * 60 * 60 * 1000)),
        status: (trip.status as ActiveTrip["status"]) ?? "on_track",
        plannedRoute: Array.isArray(trip.planned_route) ? (trip.planned_route as ActiveTrip["plannedRoute"]) : []
      }
    ];
  });

  if (trips.length > 0) {
    await repositories.activeTripMirror.upsertMany(trips);
  }

  return trips.length;
}

export async function resetDemoState() {
  await clearDemoPersistence();
  return { ok: true as const };
}
