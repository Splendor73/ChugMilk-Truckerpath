import { voiceSpeakRequestSchema } from "@/shared/schemas/contracts";
import { fail, readJson } from "@/server/core/http";
import { createRepositories } from "@/server/repositories";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { speakAlert } from "@/features/voice/server/speak-alert";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureDemoRuntimeReady();
    const input = await readJson(request, voiceSpeakRequestSchema);
    const result = await speakAlert(input);
    if (input.draftId) {
      const repositories = createRepositories();
      const draft = await repositories.interventionDrafts.findById(input.draftId);
      await repositories.interventionDrafts.setAudioSource(input.draftId, result.source);
      if (draft) {
        await repositories.decisionLog.append({
          actionType: "voice_alert_played",
          summary: `Voice alert played for ${draft.tripId}.`,
          mathSummary: `Audio source ${result.source}.`,
          outcome: result.source,
          tripId: draft.tripId,
          driverId: draft.relayDriverId ?? undefined,
          entityType: "intervention",
          source: "ui"
        });
      }
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
