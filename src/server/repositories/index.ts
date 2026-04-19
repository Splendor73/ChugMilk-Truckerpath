import { createActiveTripMirrorRepository } from "@/server/repositories/active-trip-mirror";
import { createDecisionLogRepository } from "@/server/repositories/decision-log";
import { createInterventionDraftRepository } from "@/server/repositories/intervention-drafts";
import { createLoadAssignmentRepository } from "@/server/repositories/load-assignments";

export function createRepositories() {
  return {
    activeTripMirror: createActiveTripMirrorRepository(),
    decisionLog: createDecisionLogRepository(),
    interventionDrafts: createInterventionDraftRepository(),
    loadAssignments: createLoadAssignmentRepository()
  };
}

export type RepositoryRegistry = ReturnType<typeof createRepositories>;
