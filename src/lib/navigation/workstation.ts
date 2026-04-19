export type WorkstationStage =
  | "morning_triage"
  | "load_assignment"
  | "backhaul_review"
  | "trip_monitoring";

export const workstationStageOrder: WorkstationStage[] = [
  "morning_triage",
  "load_assignment",
  "trip_monitoring"
];

export const workstationStageLabels: Record<WorkstationStage, string> = {
  morning_triage: "Morning Brief",
  load_assignment: "AI Dispatch",
  backhaul_review: "Backhaul Review",
  trip_monitoring: "Live Monitor"
};

export function normalizeWorkstationStage(value?: string | string[] | null): WorkstationStage {
  const stage = Array.isArray(value) ? value[0] : value;

  switch (stage) {
    case "load_assignment":
    case "backhaul_review":
    case "trip_monitoring":
    case "morning_triage":
      return stage;
    default:
      return "morning_triage";
  }
}
