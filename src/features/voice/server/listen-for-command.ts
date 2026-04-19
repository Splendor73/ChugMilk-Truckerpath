import { Buffer } from "node:buffer";

export async function listenForCommand(input: { audioBase64: string }) {
  let transcript = "";
  try {
    transcript = Buffer.from(input.audioBase64, "base64").toString("utf8");
  } catch {
    transcript = "";
  }

  const lower = transcript.toLowerCase();
  let matchedCommand: string | null = null;
  if (lower.includes("execute")) {
    matchedCommand = "execute";
  } else if (lower.includes("cancel")) {
    matchedCommand = "cancel";
  } else if (lower.includes("kevin")) {
    matchedCommand = "call kevin";
  }

  return {
    transcript,
    matchedCommand
  };
}
