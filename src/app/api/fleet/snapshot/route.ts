import { fleetSnapshotSchema } from "@/shared/schemas/contracts";
import { fail, ok } from "@/server/core/http";
import { getFleetSnapshot } from "@/features/fleet/server/get-fleet-snapshot";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getFleetSnapshot();
    return ok(fleetSnapshotSchema.parse(snapshot));
  } catch (error) {
    return fail(error);
  }
}
