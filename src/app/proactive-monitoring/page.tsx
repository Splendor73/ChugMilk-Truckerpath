import { AppShell } from "@/components/app-shell/app-shell";
import { ProactiveMonitoringScreen } from "@/components/screens/proactive-monitoring-screen";

export default function ProactiveMonitoringPage() {
  return (
    <AppShell currentWorkflow="proactive-monitoring">
      <ProactiveMonitoringScreen />
    </AppShell>
  );
}
