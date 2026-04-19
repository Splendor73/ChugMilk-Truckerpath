import { routeDeskCreateRequestSchema, routeDeskItemSchema, routeDeskResponseSchema } from "@/shared/schemas/contracts";
import { fail, ok, readJson } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";
import { createManagedRoute, listManagedRoutes } from "@/features/routes/server/manage-routes";

export async function GET() {
  try {
    await ensureDemoRuntimeReady();
    const routes = await listManagedRoutes();
    return ok(routeDeskResponseSchema.parse({ routes }));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureDemoRuntimeReady();
    const input = await readJson(request, routeDeskCreateRequestSchema);
    const route = await createManagedRoute(input);
    return ok(routeDeskItemSchema.parse(route));
  } catch (error) {
    return fail(error);
  }
}
