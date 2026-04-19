import { getServerEnv } from "@/config/env.server";
import { AppError } from "@/server/core/errors";

export async function speakWithElevenLabs(text: string, voiceId?: string) {
  const env = getServerEnv();
  if (!env.ELEVENLABS_API_KEY) {
    throw new AppError("ElevenLabs API key is missing.", 503, "elevenlabs_missing");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? env.ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5"
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new AppError("ElevenLabs TTS failed.", response.status, "elevenlabs_tts_failed", body);
  }

  return Buffer.from(await response.arrayBuffer());
}
