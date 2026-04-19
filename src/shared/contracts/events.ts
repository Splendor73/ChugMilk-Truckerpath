import type { BackhaulOption, DriverScore, Load } from "@/shared/contracts/domain";

export type AgentTool =
  | "get_fleet_snapshot"
  | "score_assignment"
  | "find_backhauls"
  | "monitor_trips"
  | "draft_intervention";

export type AgentStreamEvent =
  | { type: "token"; payload: { text: string } }
  | { type: "tool_call"; payload: { tool: AgentTool; args: unknown } }
  | { type: "tool_result"; payload: { tool: AgentTool; result: unknown } }
  | {
      type: "final";
      payload: { text: string; parsedLoad?: Load; scores?: DriverScore[]; backhauls?: BackhaulOption[] };
    }
  | { type: "error"; payload: { message: string } };
