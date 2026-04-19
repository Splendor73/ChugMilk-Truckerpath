import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  USE_SYNTHETIC_NAVPRO: z
    .string()
    .optional()
    .transform((value) => value == null ? true : value === "true"),
  USE_NAVPRO_MOCK: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  NAVPRO_BASE_URL: z.string().default("https://api.truckerpath.com/navpro"),
  NAVPRO_CLIENT_ID: z.string().optional(),
  NAVPRO_JWT: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional()
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export function resetServerEnvForTests() {
  cachedEnv = null;
}

export function requireLiveConfig(keys: Array<keyof ReturnType<typeof getServerEnv>>) {
  const env = getServerEnv();
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  return env;
}
