import "server-only";
import { NextResponse } from "next/server";

export const jsonError = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: { code, message, ...extra } }, { status });

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
