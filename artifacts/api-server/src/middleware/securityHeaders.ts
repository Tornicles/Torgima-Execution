import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const suspiciousActivity = new Map<string, number>();

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
  res.removeHeader("X-Powered-By");

  const ip = req.ip ?? "unknown";
  if (req.path.startsWith("/api/internal")) {
    const key = `${ip}:internal`;
    const count = (suspiciousActivity.get(key) ?? 0) + 1;
    suspiciousActivity.set(key, count);
    if (count > 10) {
      console.error("[SECURITY ALERT] Possible internal route scanning from IP:", ip);
    }
  }

  next();
}
