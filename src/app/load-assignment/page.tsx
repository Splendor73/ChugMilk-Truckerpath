import { AppShell } from "@/components/app-shell/app-shell";
import { LoadAssignmentScreen } from "@/components/screens/load-assignment-screen";

export default function LoadAssignmentPage() {
  return (
    <AppShell currentWorkflow="load-assignment">
      <LoadAssignmentScreen />
    </AppShell>
  );
}
