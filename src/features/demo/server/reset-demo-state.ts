import { getDb } from "@/server/db/client";
import { resetNavProScenario } from "@/server/integrations/navpro";

export async function clearDemoPersistence() {
  const db = getDb();

  await db.engineShowcaseDriver.deleteMany();
  await db.engineShowcaseScenario.deleteMany();
  await db.interventionDraft.deleteMany();
  await db.activeTripMirror.deleteMany();
  await db.loadAssignment.deleteMany();
  await db.decisionLog.deleteMany();

  resetNavProScenario();
}

export async function resetDemoState() {
  await clearDemoPersistence();
  return { ok: true as const };
}
