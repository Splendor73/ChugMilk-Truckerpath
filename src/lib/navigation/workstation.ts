export type WorkstationStage =
  | "morning_triage"
  | "load_assignment"
  | "backhaul_review"
  | "trip_monitoring";

export type WorkstationStageMeta = {
  stage: WorkstationStage;
  label: string;
  shellLabel: string;
  description: string;
  href: string;
};

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

export const workstationShellStages: WorkstationStageMeta[] = [
  {
    stage: "morning_triage",
    label: workstationStageLabels.morning_triage,
    shellLabel: "Morning Triage",
    description: "Review fleet readiness, rest risk, and compliance pressure before dispatch opens.",
    href: "/"
  },
  {
    stage: "load_assignment",
    label: workstationStageLabels.load_assignment,
    shellLabel: "Load Assignment",
    description: "Rank drivers, explain the score, and stage the next dispatch assignment.",
    href: "/?stage=load_assignment"
  },
  {
    stage: "backhaul_review",
    label: workstationStageLabels.backhaul_review,
    shellLabel: "Backhaul Pairing",
    description: "Evaluate return-leg options without changing the current dispatch engine.",
    href: "/?stage=backhaul_review"
  },
  {
    stage: "trip_monitoring",
    label: workstationStageLabels.trip_monitoring,
    shellLabel: "Proactive Monitoring",
    description: "Review live trip risk, play interventions, and execute recovery actions.",
    href: "/?stage=trip_monitoring"
  }
];

export const workstationTopBarStages: WorkstationStage[] = [
  "morning_triage",
  "load_assignment",
  "trip_monitoring"
];

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

export function getWorkstationStageMeta(stage: WorkstationStage) {
  return workstationShellStages.find((entry) => entry.stage === stage) ?? workstationShellStages[0];
}

export function getPrimaryWorkstationStage(stage: WorkstationStage): WorkstationStage {
  if (stage === "backhaul_review") {
    return "load_assignment";
  }

  return stage;
}

export function isWorkstationStageActive(currentStage: WorkstationStage, targetStage: WorkstationStage) {
  return getPrimaryWorkstationStage(currentStage) === getPrimaryWorkstationStage(targetStage);
}

export function buildWorkstationHref(stage: WorkstationStage, operatorMode = false) {
  const params = new URLSearchParams();

  if (stage !== "morning_triage") {
    params.set("stage", stage);
  }

  if (operatorMode) {
    params.set("operator", "1");
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}
