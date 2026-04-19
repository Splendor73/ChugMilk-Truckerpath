import { redirect } from "next/navigation";

export default function LoadAssignmentPage() {
  redirect("/?stage=load_assignment");
}
