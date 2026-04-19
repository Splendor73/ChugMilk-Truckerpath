import type { InterventionDraft } from "@/shared/contracts";
import { getDb } from "@/server/db/client";

export function createInterventionDraftRepository() {
  const db = getDb();

  return {
    async create(input: InterventionDraft & { status?: string; audioSource?: string }) {
      return db.interventionDraft.create({
        data: {
          tripId: input.tripId,
          trigger: input.trigger,
          customerSms: input.customerSms,
          relayDriverId: input.relayDriverId,
          relayDriverName: input.relayDriverName,
          relayDistanceMi: input.relayDistanceMi,
          rerouteNeeded: input.rerouteNeeded,
          voiceScript: input.voiceScript,
          status: input.status ?? "drafted",
          audioSource: input.audioSource
        }
      });
    },
    async listRecentOpen() {
      return getDb().interventionDraft.findMany({
        where: { executedAt: null },
        orderBy: { createdAt: "desc" }
      });
    },
    async listResolvedTripIds() {
      const rows = await getDb().interventionDraft.findMany({
        where: { executedAt: { not: null } },
        select: { tripId: true },
        distinct: ["tripId"]
      });
      return rows.map((row) => row.tripId);
    },
    // Deletes duplicate OPEN drafts for the same trip, keeping only the
    // most recently created one. Existing duplicates from before the tick
    // dedup fix (or created by a race between two concurrent ticks) get
    // swept away here instead of lingering in the feed. Returns the number
    // of stale rows removed.
    async pruneDuplicateOpenDrafts() {
      const db = getDb();
      const openDrafts = await db.interventionDraft.findMany({
        where: { executedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, tripId: true }
      });
      const seen = new Set<string>();
      const staleIds: string[] = [];
      for (const draft of openDrafts) {
        if (seen.has(draft.tripId)) {
          staleIds.push(draft.id);
        } else {
          seen.add(draft.tripId);
        }
      }
      if (staleIds.length > 0) {
        await db.interventionDraft.deleteMany({ where: { id: { in: staleIds } } });
      }
      return staleIds.length;
    },
    async findById(id: string) {
      return getDb().interventionDraft.findUnique({
        where: { id }
      });
    },
    async markExecuted(id: string, matchedCommand?: string) {
      return getDb().interventionDraft.update({
        where: { id },
        data: {
          executedAt: new Date(),
          status: "executed",
          matchedCommand
        }
      });
    },
    async setAudioSource(id: string, audioSource: string) {
      return getDb().interventionDraft.update({
        where: { id },
        data: {
          audioSource
        }
      });
    }
  };
}
