import type { Request, Response, NextFunction } from "express";
import { checkRateLimit } from "../monitoring/rateLimiter.js";
import { failure } from "../lib/utils.js";

const SKIP_PREFIXES = [
  "/api/health",
  "/api/healthz",
  "/api/bhudhi/health",
  "/api/bhudhi/monitoring",
  "/api/bhudhi/consolidation",
  "/api/bhudhi/certification",
  "/api/torgima/bhudhi",
  "/api/metrics",
];

function blueprintKey(req: Request): string {
  const header = req.headers["x-blueprint-id"];
  if (typeof header === "string" && header.length > 0) return header;

  const q = req.query.blueprintId;
  if (typeof q === "string" && q.length > 0) return q;

  const body = req.body as { blueprintId?: string } | undefined;
  if (body?.blueprintId) return body.blueprintId;

  return "anonymous";
}

export async function bhudhiRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const path = req.originalUrl.split("?")[0];
  if (!path.startsWith("/api/bhudhi")) {
    next();
    return;
  }

  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
    next();
    return;
  }

  const key = `bhudhi:${blueprintKey(req)}`;
  const allowed = await checkRateLimit(key, 10, 60_000);

  if (!allowed) {
    failure(res, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded for Bhudhi API", 429);
    return;
  }

  next();
}
