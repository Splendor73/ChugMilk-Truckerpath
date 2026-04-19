import { advancedRankingShowcaseResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok } from "@/server/core/http";
import { getAdvancedRankingShowcase } from "@/features/dispatch/server/advanced-ranking-showcase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = await getAdvancedRankingShowcase();
    return ok(advancedRankingShowcaseResponseSchema.parse(payload));
  } catch (error) {
    return fail(error);
  }
}
