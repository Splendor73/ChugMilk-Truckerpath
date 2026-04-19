import type { LLMMessage } from "@/shared/contracts";
import { getServerEnv } from "@/config/env.server";
import { AppError } from "@/server/core/errors";

export async function groqChat(messages: LLMMessage[]) {
  const env = getServerEnv();
  if (!env.GROQ_API_KEY) {
    throw new AppError("Groq API key is missing.", 503, "groq_missing");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages
    })
  });

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  if (!response.ok) {
    throw new AppError("Groq completion failed.", response.status, "groq_failed", json);
  }

  return {
    content: json.choices?.[0]?.message?.content ?? "",
    usage: json.usage
      ? {
          promptTokens: json.usage.prompt_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0
        }
      : undefined
  };
}
