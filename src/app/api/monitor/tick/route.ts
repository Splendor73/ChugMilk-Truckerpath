import { monitorTickResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { runMonitoringTick } from "@/features/monitoring/server/run-monitoring-tick";

export const runtime = "nodejs";

export async function POST() {
  try {
    await ensureDemoRuntimeReady();
    const response = await runMonitoringTick();
    return ok(monitorTickResponseSchema.parse(response));
  } catch (error) {
    return fail(error);
  }
}
