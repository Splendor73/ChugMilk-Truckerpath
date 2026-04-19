import { voiceSpeakRequestSchema } from "@/shared/schemas/contracts";
import { fail, readJson } from "@/server/core/http";
import { createRepositories } from "@/server/repositories";
import { speakAlert } from "@/features/voice/server/speak-alert";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await readJson(request, voiceSpeakRequestSchema);
    const result = await speakAlert(input);
    if (input.draftId) {
      const repositories = createRepositories();
      await repositories.interventionDrafts.setAudioSource(input.draftId, result.source);
    }
    const body = new Uint8Array(result.audio);
    return new Response(body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Source": result.source
      }
    });
  } catch (error) {
    return fail(error);
  }
}
