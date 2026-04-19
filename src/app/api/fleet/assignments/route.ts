import { assignmentRequestSchema, assignmentResponseSchema } from "@/shared/schemas/contracts";
import { createAssignment } from "@/features/dispatch/server/create-assignment";
import { fail, ok, readJson } from "@/server/core/http";
import { ensureDemoRuntimeReady } from "@/server/runtime/demo-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureDemoRuntimeReady();
    const input = await readJson(request, assignmentRequestSchema);
    const response = await createAssignment(input);
    return ok(assignmentResponseSchema.parse(response));
  } catch (error) {
    return fail(error);
  }
}
