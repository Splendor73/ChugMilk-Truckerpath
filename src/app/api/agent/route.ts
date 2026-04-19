import { agentRequestSchema } from "@/shared/schemas/contracts";
import { fail, readJson } from "@/server/core/http";
import { runCopilot } from "@/features/copilot/server/run-copilot";

export const runtime = "nodejs";

function encodeEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  try {
    const input = await readJson(request, agentRequestSchema);
    const encoder = new TextEncoder();
    const iterator = runCopilot(input);

    const stream = new ReadableStream({
      async pull(controller) {
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(encodeEvent(next.value)));
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    return fail(error);
  }
}
