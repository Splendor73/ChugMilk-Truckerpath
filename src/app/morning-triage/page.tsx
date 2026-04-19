import { AppShell } from "@/components/app-shell/app-shell";
import { MorningTriageScreen } from "@/components/screens/morning-triage-screen";

export default function MorningTriagePage() {
  return (
    <AppShell currentWorkflow="morning-triage">
      <MorningTriageScreen />
    </AppShell>
  );
}
