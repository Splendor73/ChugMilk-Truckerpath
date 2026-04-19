export type WorkflowId =
  | "morning-triage"
  | "load-assignment"
  | "backhaul-pairing"
  | "proactive-monitoring";

export type Workflow = {
  id: WorkflowId;
  label: string;
  href: string;
};

export const shellTopBarWorkflowIds = ["morning-triage", "backhaul-pairing"] as const satisfies readonly WorkflowId[];

export const workflows: Workflow[] = [
  {
    id: "morning-triage",
    label: "Morning Triage",
    href: "/morning-triage",
  },
  {
    id: "load-assignment",
    label: "Load Assignment",
    href: "/load-assignment",
  },
  {
    id: "backhaul-pairing",
    label: "Backhaul Pairing",
    href: "/backhaul-pairing",
  },
  {
    id: "proactive-monitoring",
    label: "Proactive Monitoring",
    href: "/proactive-monitoring",
  },
];

export function getWorkflow(workflowId: WorkflowId) {
  return workflows.find((workflow) => workflow.id === workflowId);
}

export function getShellTopBarWorkflows() {
  return shellTopBarWorkflowIds
    .map((workflowId) => getWorkflow(workflowId))
    .filter((workflow): workflow is Workflow => workflow !== undefined);
}
