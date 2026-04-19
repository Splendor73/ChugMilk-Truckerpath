import { agentScoreRequestSchema } from "@/shared/schemas/contracts";
import { fail, ok, readJson } from "@/server/core/http";
import { scoreLoad } from "@/features/dispatch/server/score-load";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await readJson(request, agentScoreRequestSchema);
    const scores = await scoreLoad(input.load);
    return ok(scores);
  } catch (error) {
    return fail(error);
  }
}
