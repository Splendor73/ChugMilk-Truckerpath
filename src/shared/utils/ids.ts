import crypto from "node:crypto";

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createTripId(prefix = "trip") {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}
