import { monitorFeedResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { getMonitorFeed } from "@/features/monitoring/server/get-monitor-feed";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDemoRuntimeReady();
    const response = await getMonitorFeed();
    return ok(monitorFeedResponseSchema.parse(response));
  } catch (error) {
    return fail(error);
  }
}
