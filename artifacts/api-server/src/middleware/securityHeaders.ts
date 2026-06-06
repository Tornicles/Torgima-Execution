import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const suspiciousActivity = new Map<string, number>();

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.removeHeader("X-Powered-By");

  const path = req.path;
  if (path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  } else if (path === "/health" || path === "/healthz") {
    res.setHeader("Cache-Control", "public, max-age=30");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }

  const ip = req.ip ?? "unknown";
  if (req.path.startsWith("/api/internal")) {
    const key = `${ip}:internal`;
    const count = (suspiciousActivity.get(key) ?? 0) + 1;
    suspiciousActivity.set(key, count);
    if (count > 10) {
      logger.error({ ip }, "[SECURITY ALERT] Possible internal route scanning");
    }
  }

  next();
}
