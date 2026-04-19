import type { LLMMessage, LLMResponse, LLMTool } from "@/shared/contracts";
import { geminiChat } from "@/server/integrations/gemini";
import { groqChat } from "@/server/integrations/groq";

export async function callLLM(
  messages: LLMMessage[],
  _tools?: LLMTool[],
  opts?: { model?: "groq" | "gemini" }
): Promise<LLMResponse> {
  const model = opts?.model ?? "groq";

  if (model === "gemini") {
    const result = await geminiChat(messages);
    return { content: result.content, model: "gemini", usage: result.usage };
  }

  try {
    const result = await groqChat(messages);
    return { content: result.content, model: "groq", usage: result.usage };
  } catch {
    const result = await geminiChat(messages);
    return { content: result.content, model: "gemini", usage: result.usage };
  }
}
