import type { MonitorFeedResponse, MonitorDraftView } from "@/shared/contracts";
import { createRepositories } from "@/server/repositories";

function toDraftView(row: Awaited<ReturnType<ReturnType<typeof createRepositories>["interventionDrafts"]["listRecentOpen"]>>[number]): MonitorDraftView {
  return {
    id: row.id,
    tripId: row.tripId,
    trigger: row.trigger as MonitorDraftView["trigger"],
    customerSms: row.customerSms,
    relayDriverId: row.relayDriverId,
    relayDriverName: row.relayDriverName,
    relayDistanceMi: row.relayDistanceMi,
    rerouteNeeded: row.rerouteNeeded,
    voiceScript: row.voiceScript,
    createdAtMs: row.createdAt.getTime(),
    status: row.status,
    audioSource: row.audioSource,
    executedAtMs: row.executedAt ? row.executedAt.getTime() : null,
    matchedCommand: row.matchedCommand
  };
}

export async function getMonitorFeed(): Promise<MonitorFeedResponse> {
  const repositories = createRepositories();
  const [drafts, decisionLog, metrics] = await Promise.all([
    repositories.interventionDrafts.listRecentOpen(),
    repositories.decisionLog.list(),
    repositories.decisionLog.getMetrics()
  ]);

  return {
    drafts: drafts.map(toDraftView),
    decisionLog,
    metrics
  };
}
