import { execSync } from "node:child_process";

import { resetServerEnvForTests } from "@/config/env.server";
import { getDb } from "@/server/db/client";

let bootstrapped = false;

export function configureBackendTestEnv() {
  process.env.DATABASE_URL = "file:./dev.db";
  process.env.USE_SYNTHETIC_NAVPRO = "true";
  process.env.USE_NAVPRO_MOCK = "true";
  process.env.NAVPRO_CLIENT_ID = "";
  process.env.NAVPRO_JWT = "";
  process.env.GROQ_API_KEY = "";
  process.env.GEMINI_API_KEY = "";
  process.env.ELEVENLABS_API_KEY = "";
  resetServerEnvForTests();
}

export async function bootstrapBackendTests() {
  configureBackendTestEnv();
  if (!bootstrapped) {
    execSync("rm -f prisma/dev.db && npm run db:bootstrap", {
      cwd: process.cwd(),
      stdio: "ignore"
    });
    bootstrapped = true;
  }
  await clearDatabase();
}

export async function clearDatabase() {
  const db = getDb();
  await db.engineShowcaseDriver.deleteMany();
  await db.engineShowcaseScenario.deleteMany();
  await db.interventionDraft.deleteMany();
  await db.activeTripMirror.deleteMany();
  await db.loadAssignment.deleteMany();
  await db.decisionLog.deleteMany();
}

export async function closeDatabase() {
  if (global.__coDispatchPrisma__) {
    await global.__coDispatchPrisma__.$disconnect();
    global.__coDispatchPrisma__ = undefined;
  }
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function readSse(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.replace(/^data:\s*/, ""))
    .map((chunk) => JSON.parse(chunk));
}
