import type { ActiveTrip } from "@/shared/contracts";
import { getDb } from "@/server/db/client";

export function createActiveTripMirrorRepository() {
  const db = getDb();

  return {
    async upsertMany(trips: ActiveTrip[]) {
      await Promise.all(
        trips.map((trip) =>
          db.activeTripMirror.upsert({
            where: { tripId: trip.tripId },
            update: {
              driverId: trip.driverId,
              loadId: trip.loadId,
              status: trip.status,
              lastSeenAt: new Date(),
              etaMs: BigInt(Math.round(trip.etaMs)),
              currentLat: trip.currentLoc.lat,
              currentLng: trip.currentLoc.lng,
              plannedRouteJson: JSON.stringify(trip.plannedRoute),
              sourceUpdatedAt: new Date()
            },
            create: {
              tripId: trip.tripId,
              driverId: trip.driverId,
              loadId: trip.loadId,
              status: trip.status,
              lastSeenAt: new Date(),
              etaMs: BigInt(Math.round(trip.etaMs)),
              currentLat: trip.currentLoc.lat,
              currentLng: trip.currentLoc.lng,
              plannedRouteJson: JSON.stringify(trip.plannedRoute),
              sourceUpdatedAt: new Date()
            }
          })
        )
      );
    },
    async listAll() {
      return db.activeTripMirror.findMany({ orderBy: { lastSeenAt: "desc" } });
    },
    async createManual(input: {
      tripId: string;
      driverId: number;
      loadId: string;
      status: ActiveTrip["status"];
      etaMs: number;
      currentLoc: ActiveTrip["currentLoc"];
      plannedRoute: ActiveTrip["plannedRoute"];
    }) {
      return db.activeTripMirror.create({
        data: {
          tripId: input.tripId,
          driverId: input.driverId,
          loadId: input.loadId,
          status: input.status,
          lastSeenAt: new Date(),
          etaMs: BigInt(Math.round(input.etaMs)),
          currentLat: input.currentLoc.lat,
          currentLng: input.currentLoc.lng,
          plannedRouteJson: JSON.stringify(input.plannedRoute),
          sourceUpdatedAt: new Date()
        }
      });
    },
    async findByTripId(tripId: string) {
      return db.activeTripMirror.findUnique({ where: { tripId } });
    },
    async deleteByTripId(tripId: string) {
      return db.activeTripMirror.delete({ where: { tripId } });
    },
    async setScenarioOverride(tripId: string, scenario: string) {
      return db.activeTripMirror.update({
        where: { tripId },
        data: {
          scenarioOverride: scenario,
          overrideReason: scenario,
          lastSeenAt: new Date()
        }
      });
    },
    async markMitigated(input: {
      tripId: string;
      status?: ActiveTrip["status"];
      overrideReason: string;
      etaMs?: number;
    }) {
      return db.activeTripMirror.update({
        where: { tripId: input.tripId },
        data: {
          status: input.status ?? "on_track",
          scenarioOverride: null,
          overrideReason: input.overrideReason,
          ...(input.etaMs ? { etaMs: BigInt(Math.round(input.etaMs)) } : {}),
          lastSeenAt: new Date(),
          sourceUpdatedAt: new Date()
        }
      });
    }
  };
}
