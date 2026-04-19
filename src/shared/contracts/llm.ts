import type { AgentTool } from "@/shared/contracts/events";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface LLMTool {
  name: AgentTool;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{ id: string; name: AgentTool; args: unknown }>;
  model: "groq" | "gemini";
  usage?: { promptTokens: number; completionTokens: number };
}
