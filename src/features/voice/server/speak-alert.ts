import fs from "node:fs/promises";
import path from "node:path";

import { speakWithElevenLabs } from "@/server/integrations/elevenlabs";

const fallbackAudio = path.join(process.cwd(), "public", "act3-fallback.mp3");

export async function speakAlert(input: { text: string; voiceId?: string }) {
  try {
    return {
      audio: await speakWithElevenLabs(input.text, input.voiceId),
      source: "live" as const
    };
  } catch {
    try {
      return {
        audio: await fs.readFile(fallbackAudio),
        source: "fallback" as const
      };
    } catch {
      return {
        audio: Buffer.from("Fallback audio unavailable."),
        source: "fallback" as const
      };
    }
  }
}
