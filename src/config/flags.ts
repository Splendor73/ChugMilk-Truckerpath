import { getServerEnv } from "@/config/env.server";

export function getFlags() {
  const env = getServerEnv();
  return {
    useSyntheticNavPro: env.USE_SYNTHETIC_NAVPRO,
    useNavProMock: env.USE_NAVPRO_MOCK,
    hasLiveNavPro: Boolean(env.NAVPRO_CLIENT_ID && env.NAVPRO_JWT),
    hasGroq: Boolean(env.GROQ_API_KEY),
    hasGemini: Boolean(env.GEMINI_API_KEY),
    hasElevenLabs: Boolean(env.ELEVENLABS_API_KEY)
  };
}
