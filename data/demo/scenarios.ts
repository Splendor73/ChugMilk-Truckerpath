export const DEMO_BREAKDOWN_SCRIPT =
  "Maria, truck 14 has been stopped 47 minutes outside Barstow. Engine idle pattern suggests breakdown. I've drafted the customer SMS with a revised ETA, found relay driver Kevin 28 miles away with 9 HOS hours left, and prepped the swap plan. Say 'execute' to approve.";

export const SCENARIO_STAGES = [
  "morning_triage",
  "load_assignment",
  "backhaul_pairing",
  "in_transit_monitoring"
] as const;

export type ScenarioStage = (typeof SCENARIO_STAGES)[number];

export type ScenarioControlAction = "reset" | "set_stage" | "trigger_trip" | "freeze";
