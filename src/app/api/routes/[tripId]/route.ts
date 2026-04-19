import { deleteManagedRoute, updateManagedRoute } from "@/features/routes/server/manage-routes";
import { fail, ok, readJson } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { routeDeskItemSchema, routeDeskUpdateRequestSchema } from "@/shared/schemas/contracts";

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

export async function PATCH(
  request: Request,
  { params }: { params: { tripId: string } }
) {
  try {
    await ensureDemoRuntimeReady();
    const input = await readJson(request, routeDeskUpdateRequestSchema);
    const updated = await updateManagedRoute(decodeURIComponent(params.tripId), input);
    return ok(routeDeskItemSchema.parse(updated));
  } catch (error) {
    return fail(error);
  }
}
