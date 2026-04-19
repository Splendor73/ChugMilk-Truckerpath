import { createRepositories } from "@/server/repositories";

export async function getDecisionMetrics() {
  const repositories = createRepositories();
  return repositories.decisionLog.getMetrics();
}
