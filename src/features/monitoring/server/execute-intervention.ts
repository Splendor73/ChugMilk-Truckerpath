import type { InterventionExecuteResponse } from "@/shared/contracts";
import { createRepositories } from "@/server/repositories";
import { AppError } from "@/server/core/errors";
import { nowMs } from "@/shared/utils/time";

export async function executeIntervention(input: {
  draftId: string;
  matchedCommand?: string;
}): Promise<InterventionExecuteResponse> {
  const repositories = createRepositories();
  const draft = await repositories.interventionDrafts.findById(input.draftId);

  if (!draft) {
    throw new AppError(`Intervention draft ${input.draftId} was not found.`, 404, "not_found");
  }

  await repositories.interventionDrafts.markExecuted(input.draftId, input.matchedCommand);
  await repositories.activeTripMirror.markMitigated({
    tripId: draft.tripId,
    status: "on_track",
    overrideReason: "relay_executed",
    etaMs: nowMs() + 45 * 60 * 1000
  });
  await repositories.decisionLog.append({
    actionType: "intervention_executed",
    summary: `Executed intervention for ${draft.tripId}.`,
    mathSummary: draft.relayDriverName
      ? `Relay driver ${draft.relayDriverName} approved at ${draft.relayDistanceMi ?? 0} miles away.`
      : undefined,
    outcome: input.matchedCommand ?? "execute",
    tripId: draft.tripId,
    driverId: draft.relayDriverId ?? undefined,
    timeSavedMin: draft.relayDriverId ? 45 : 20,
    entityType: "intervention",
    source: "ui"
  });

  return {
    ok: true,
    draftId: input.draftId
  };
}
