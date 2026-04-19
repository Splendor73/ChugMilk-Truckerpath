import type { LLMMessage } from "@/shared/contracts";
import { getServerEnv } from "@/config/env.server";
import { AppError } from "@/server/core/errors";

export async function geminiChat(messages: LLMMessage[]) {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) {
    throw new AppError("Gemini API key is missing.", 503, "gemini_missing");
  }

  const prompt = messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  if (!response.ok) {
    throw new AppError("Gemini completion failed.", response.status, "gemini_failed", json);
  }

  return {
    content: json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "",
    usage: json.usageMetadata
      ? {
          promptTokens: json.usageMetadata.promptTokenCount ?? 0,
          completionTokens: json.usageMetadata.candidatesTokenCount ?? 0
        }
      : undefined
  };
}
