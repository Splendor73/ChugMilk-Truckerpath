import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

import { AppError, toErrorMessage } from "@/server/core/errors";

export async function readJson<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json();
  return schema.parse(body);
}

export function ok<T>(payload: T) {
  return NextResponse.json(payload);
}

export function fail(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { code: "internal_error", message: toErrorMessage(error) },
    { status: 500 }
  );
}
