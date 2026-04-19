import { AppShell } from "@/components/app-shell/app-shell";
import { BackhaulPairingScreen } from "@/components/screens/backhaul-pairing-screen";

export default function BackhaulPairingPage() {
  return (
    <AppShell currentWorkflow="backhaul-pairing">
      <BackhaulPairingScreen />
    </AppShell>
  );
}
