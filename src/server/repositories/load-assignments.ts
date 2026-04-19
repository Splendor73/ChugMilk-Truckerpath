import type { FleetAssignmentRequest } from "@/shared/contracts";
import { getDb } from "@/server/db/client";

export function createLoadAssignmentRepository() {
  const db = getDb();

  return {
    async create(
      input: FleetAssignmentRequest & {
        tripId: string;
        returnTripId?: string;
        metadata?: Record<string, unknown>;
        scoreSnapshot?: unknown;
        backhaulNarrative?: string | null;
        profitDeltaUsd?: number | null;
      }
    ) {
      return db.loadAssignment.create({
        data: {
          driverId: input.driverId,
          loadId: input.loadId,
          returnLoadId: input.returnLoadId,
          tripId: input.tripId,
          returnTripId: input.returnTripId,
          status: input.returnTripId ? "round_trip_created" : "created",
          scoreSnapshotJson: input.scoreSnapshot != null ? JSON.stringify(input.scoreSnapshot) : null,
          navProPayloadJson: input.metadata ? JSON.stringify(input.metadata) : null,
          backhaulNarrative: input.backhaulNarrative ?? null,
          profitDeltaUsd: input.profitDeltaUsd ?? null
        }
      });
    }
  };
}
