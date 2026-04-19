import { monitorFeedResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok } from "@/server/core/http";
import { getMonitorFeed } from "@/features/monitoring/server/get-monitor-feed";

export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await getMonitorFeed();
    return ok(monitorFeedResponseSchema.parse(response));
  } catch (error) {
    return fail(error);
  }
}
