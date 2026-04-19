import { interventionExecuteRequestSchema, interventionExecuteResponseSchema } from "@/shared/schemas/contracts";
import { executeIntervention } from "@/features/monitoring/server/execute-intervention";
import { fail, ok, readJson } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureDemoRuntimeReady();
    const input = await readJson(request, interventionExecuteRequestSchema);
    const response = await executeIntervention(input);
    return ok(interventionExecuteResponseSchema.parse(response));
  } catch (error) {
    return fail(error);
  }
}
