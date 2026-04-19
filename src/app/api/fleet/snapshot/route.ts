import { fleetSnapshotSchema } from "@/shared/schemas/contracts";
import { fail, ok } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { getFleetSnapshot } from "@/features/fleet/server/get-fleet-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDemoRuntimeReady();
    const snapshot = await getFleetSnapshot();
    return ok(fleetSnapshotSchema.parse(snapshot));
  } catch (error) {
    return fail(error);
  }
}
