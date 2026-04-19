import type { AppendDecisionLogInput } from "@/server/repositories/decision-log";
import { createRepositories } from "@/server/repositories";

export async function appendDecisionLog(input: AppendDecisionLogInput) {
  const repositories = createRepositories();
  return repositories.decisionLog.append(input);
}
