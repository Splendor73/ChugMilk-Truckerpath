import { redirect } from "next/navigation";

export default function BackhaulPairingPage() {
  redirect("/?stage=backhaul_review");
}
