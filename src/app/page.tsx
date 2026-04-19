import { DispatchWorkstation } from "@/components/workstation/dispatch-workstation";
import { normalizeWorkstationDeskPanel, normalizeWorkstationStage } from "@/lib/navigation/workstation";

export default function HomePage({
  searchParams
}: {
  searchParams?: { stage?: string | string[]; operator?: string | string[]; panel?: string | string[] };
}) {
  const initialDeskPanel = normalizeWorkstationDeskPanel(searchParams?.panel);
  const initialStage = initialDeskPanel
    ? "morning_triage"
    : normalizeWorkstationStage(searchParams?.stage);
  const operatorParam = Array.isArray(searchParams?.operator) ? searchParams?.operator[0] : searchParams?.operator;
  const initialOperatorMode = operatorParam === "1" || operatorParam === "true";

  return (
    <DispatchWorkstation
      initialStage={initialStage}
      initialOperatorMode={initialOperatorMode}
      initialDeskPanel={initialDeskPanel}
    />
  );
}
