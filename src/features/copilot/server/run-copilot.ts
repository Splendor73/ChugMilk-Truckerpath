import type { AgentStreamEvent, DriverScore, Load } from "@/shared/contracts";
import { getFleetSnapshot } from "@/features/fleet/server/get-fleet-snapshot";
import { parseLoadInput } from "@/features/dispatch/server/parse-load";
import { scoreLoad } from "@/features/dispatch/server/score-load";
import { getBackhaulOptions } from "@/features/backhaul/server/find-backhauls";
import { runMonitoringTick } from "@/features/monitoring/server/run-monitoring-tick";
import { draftIntervention } from "@/features/monitoring/server/draft-intervention";

async function* emitText(text: string): AsyncGenerator<AgentStreamEvent> {
  for (const chunk of text.split(/\s+/).filter(Boolean)) {
    yield { type: "token", payload: { text: `${chunk} ` } };
  }
}

function formatHours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10}`;
}

function buildLoadSummary(input: {
  snapshotReadyCount: number;
  parsedLoad?: Load;
  scores?: DriverScore[];
  backhauls?: Awaited<ReturnType<typeof getBackhaulOptions>>;
}) {
  const topScore = input.scores?.find((score) => !score.eliminated) ?? null;
  const topBackhaul = input.backhauls?.[0] ?? null;

  if (!input.parsedLoad || !input.scores) {
    return `Fleet snapshot is ready with ${input.snapshotReadyCount} drivers currently available.`;
  }

  if (!topScore) {
    const blockers = input.scores
      .slice(0, 2)
      .map((score) => `${score.driverName}: ${score.eliminationReason ?? "not dispatchable"}`)
      .join("; ");
    return `No safe driver is available for ${input.parsedLoad.origin.city} to ${input.parsedLoad.destination.city} right now. ${blockers}.`;
  }

  let text = `${topScore.driverName} leads for ${input.parsedLoad.origin.city} to ${input.parsedLoad.destination.city} with score ${topScore.score}, ${topScore.deadheadMiles} deadhead miles, ${formatHours(topScore.hosCheck.availableMin)} HOS hours available against ${formatHours(topScore.hosCheck.requiredMin)} needed, and ${topScore.rippleImpact.affectedLoads} nearby loads affected.`;

  if (topBackhaul) {
    text += ` Best backhaul is ${topBackhaul.returnLoad.origin.city} to ${topBackhaul.returnLoad.destination.city}; round-trip profit moves from $${topBackhaul.oneWayProfitUsd} to $${topBackhaul.roundTripProfitUsd} with ${topBackhaul.totalDeadheadMiles} total deadhead miles.`;
  }

  return text;
}

function looksLikeLoadMessage(input: string) {
  const lower = input.toLowerCase();
  return lower.includes("load") || lower.includes("pickup") || lower.includes(" to ");
}

export async function* runCopilot(input: {
  userMessage: string;
  context?: Record<string, unknown>;
}): AsyncGenerator<AgentStreamEvent> {
  try {
    const message = input.userMessage.trim();
    const lower = message.toLowerCase();

    if (!looksLikeLoadMessage(message) && !lower.includes("fleet") && !lower.includes("monitor") && !lower.includes("trip")) {
      const refusal = "I can help with fleet status, assignment ranking, backhauls, monitoring, and interventions only.";
      yield* emitText(refusal);
      yield { type: "final", payload: { text: refusal } };
      return;
    }

    yield { type: "tool_call", payload: { tool: "get_fleet_snapshot", args: {} } };
    const snapshot = await getFleetSnapshot();
    yield { type: "tool_result", payload: { tool: "get_fleet_snapshot", result: snapshot } };

    if (lower.includes("monitor")) {
      yield { type: "tool_call", payload: { tool: "monitor_trips", args: {} } };
      const result = await runMonitoringTick();
      yield { type: "tool_result", payload: { tool: "monitor_trips", result } };
      const text = result.interventionsCreated > 0
        ? `Monitoring found ${result.interventionsCreated} intervention candidates.`
        : "Monitoring found no active trip interventions right now.";
      yield* emitText(text);
      yield { type: "final", payload: { text } };
      return;
    }

    let parsedLoad: Load | undefined;
    let scores: DriverScore[] | undefined;
    let backhauls = undefined;

    if (looksLikeLoadMessage(message)) {
      parsedLoad = await parseLoadInput({ userMessage: message });
      yield { type: "tool_call", payload: { tool: "score_assignment", args: { loadId: parsedLoad.loadId } } };
      scores = await scoreLoad(parsedLoad);
      yield { type: "tool_result", payload: { tool: "score_assignment", result: scores } };

      const topScore = scores.find((score) => !score.eliminated);
      if (topScore) {
        yield { type: "tool_call", payload: { tool: "find_backhauls", args: { outboundLoadId: parsedLoad.loadId, driverId: topScore.driverId } } };
        backhauls = await getBackhaulOptions({ outboundLoadId: parsedLoad.loadId, driverId: topScore.driverId });
        yield { type: "tool_result", payload: { tool: "find_backhauls", result: backhauls } };
      }
    }

    if (lower.includes("intervention")) {
      yield { type: "tool_call", payload: { tool: "draft_intervention", args: { tripId: "TRIP-ACT3" } } };
      const intervention = await draftIntervention({ tripId: "TRIP-ACT3", trigger: "long_idle" });
      yield { type: "tool_result", payload: { tool: "draft_intervention", result: intervention } };
    }

    const text = buildLoadSummary({
      snapshotReadyCount: snapshot.morningBrief.readyCount,
      parsedLoad,
      scores,
      backhauls
    });

    yield* emitText(text);
    yield { type: "final", payload: { text, ...(parsedLoad ? { parsedLoad } : {}), ...(scores ? { scores } : {}), ...(backhauls ? { backhauls } : {}) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Copilot request failed.";
    yield { type: "error", payload: { message } };
    yield { type: "final", payload: { text: message } };
  }
}
