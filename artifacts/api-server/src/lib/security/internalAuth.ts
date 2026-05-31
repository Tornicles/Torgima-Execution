import type { Request } from "express";

export const INTERNAL_AUTH_HEADERS = ["x-internal-auth", "x-internal-token"] as const;

export function getInternalAuthSecret(): string {
  return (
    process.env["INTERNAL_AUTH_SECRET"]?.trim() ||
    process.env["INTERNAL_SERVICE_SECRET"]?.trim() ||
    ""
  );
}

export function extractInternalToken(req: Request): string | undefined {
  for (const name of INTERNAL_AUTH_HEADERS) {
    const v = req.headers[name];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
