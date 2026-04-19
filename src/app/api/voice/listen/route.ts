import { voiceListenRequestSchema, voiceListenResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok, readJson } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { listenForCommand } from "@/features/voice/server/listen-for-command";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureDemoRuntimeReady();
    const input = await readJson(request, voiceListenRequestSchema);
    const result = await listenForCommand(input);
    return ok(voiceListenResponseSchema.parse(result));
  } catch (error) {
    return fail(error);
  }
}
