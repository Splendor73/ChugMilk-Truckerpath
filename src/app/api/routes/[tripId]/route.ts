import { deleteManagedRoute } from "@/features/routes/server/manage-routes";
import { fail, ok } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";

export async function DELETE(
  _request: Request,
  { params }: { params: { tripId: string } }
) {
  try {
    await ensureDemoRuntimeReady();
    const result = await deleteManagedRoute(decodeURIComponent(params.tripId));
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
