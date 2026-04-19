import { advancedRankingShowcaseResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { getAdvancedRankingShowcase } from "@/features/dispatch/server/advanced-ranking-showcase";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDemoRuntimeReady();
    const payload = await getAdvancedRankingShowcase();
    return ok(advancedRankingShowcaseResponseSchema.parse(payload));
  } catch (error) {
    return fail(error);
  }
}
