import { resetServerEnvForTests } from "@/config/env.server";
import { getDb } from "@/server/db/client";

export function configureBackendTestEnv() {
  const runtimeDatabaseUrl = process.env.DATABASE_URL;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  const allowSharedTestDatabase = process.env.ALLOW_SHARED_TEST_DATABASE === "true";

  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for database-backed tests.");
  }

  if (!allowSharedTestDatabase && runtimeDatabaseUrl && runtimeDatabaseUrl === testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL must not match DATABASE_URL.");
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DIRECT_URL = process.env.DIRECT_URL || testDatabaseUrl;
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
