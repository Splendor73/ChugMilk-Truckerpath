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
