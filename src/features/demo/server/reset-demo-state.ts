import { getDb } from "@/server/db/client";
import { resetNavProScenario } from "@/server/integrations/navpro";

export async function resetDemoState() {
  const db = getDb();

  await db.engineShowcaseDriver.deleteMany();
  await db.engineShowcaseScenario.deleteMany();
  await db.interventionDraft.deleteMany();
  await db.activeTripMirror.deleteMany();
  await db.loadAssignment.deleteMany();
  await db.decisionLog.deleteMany();

  resetNavProScenario();

  return { ok: true as const };
}
