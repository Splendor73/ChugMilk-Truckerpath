import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __coDispatchPrisma__: PrismaClient | undefined;
}

export function getDb() {
  if (!global.__coDispatchPrisma__) {
    global.__coDispatchPrisma__ = new PrismaClient();
  }
  return global.__coDispatchPrisma__;
}
