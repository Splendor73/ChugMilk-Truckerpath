import type { DecisionLogViewModel } from "@/shared/contracts";
import { getDb } from "@/server/db/client";

export interface AppendDecisionLogInput {
  actionType: string;
  summary: string;
  mathSummary?: string;
  outcome: string;
  tripId?: string;
  driverId?: number;
  deadheadSavedMi?: number;
  revenueRecoveredUsd?: number;
  timeSavedMin?: number;
  entityType?: string;
  source?: string;
}

export function createDecisionLogRepository() {
  const db = getDb();

  return {
    async append(input: AppendDecisionLogInput) {
      return db.decisionLog.create({
        data: {
          actionType: input.actionType,
          summary: input.summary,
          mathSummary: input.mathSummary,
          outcome: input.outcome,
          tripId: input.tripId,
          driverId: input.driverId,
          deadheadSavedMi: input.deadheadSavedMi,
          revenueRecoveredUsd: input.revenueRecoveredUsd,
          timeSavedMin: input.timeSavedMin,
          entityType: input.entityType,
          source: input.source
        }
      });
    },
    async list(): Promise<DecisionLogViewModel[]> {
      const rows = await db.decisionLog.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map((row: (typeof rows)[number]) => ({
        id: row.id,
        createdAtMs: row.createdAt.getTime(),
        actionType: row.actionType,
        summary: row.summary,
        mathSummary: row.mathSummary ?? undefined,
        outcome: row.outcome
      }));
    },
    async getMetrics() {
      const aggregate = await db.decisionLog.aggregate({
        _sum: {
          deadheadSavedMi: true,
          revenueRecoveredUsd: true,
          timeSavedMin: true
        }
      });

      return {
        deadheadSavedMi: aggregate._sum.deadheadSavedMi ?? 0,
        revenueRecoveredUsd: aggregate._sum.revenueRecoveredUsd ?? 0,
        timeSavedMin: aggregate._sum.timeSavedMin ?? 0
      };
    }
  };
}
