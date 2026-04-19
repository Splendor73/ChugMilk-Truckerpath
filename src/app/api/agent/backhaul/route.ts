import { agentBackhaulRequestSchema, backhaulOptionSchema } from "@/shared/schemas/contracts";
import { fail, ok, readJson } from "@/server/core/http";
import { getBackhaulOptions } from "@/features/backhaul/server/find-backhauls";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await readJson(request, agentBackhaulRequestSchema);
    const options = await getBackhaulOptions(input);
    return ok(options.map((option) => backhaulOptionSchema.parse(option)));
  } catch (error) {
    return fail(error);
  }
}
