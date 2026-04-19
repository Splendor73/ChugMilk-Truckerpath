import { interventionExecuteRequestSchema, interventionExecuteResponseSchema } from "@/shared/schemas/contracts";
import { executeIntervention } from "@/features/monitoring/server/execute-intervention";
import { fail, ok, readJson } from "@/server/core/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await readJson(request, interventionExecuteRequestSchema);
    const response = await executeIntervention(input);
    return ok(interventionExecuteResponseSchema.parse(response));
  } catch (error) {
    return fail(error);
  }
}
