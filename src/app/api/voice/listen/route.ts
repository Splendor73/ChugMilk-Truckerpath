import { voiceListenRequestSchema, voiceListenResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok, readJson } from "@/server/core/http";
import { listenForCommand } from "@/features/voice/server/listen-for-command";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await readJson(request, voiceListenRequestSchema);
    const result = await listenForCommand(input);
    return ok(voiceListenResponseSchema.parse(result));
  } catch (error) {
    return fail(error);
  }
}
