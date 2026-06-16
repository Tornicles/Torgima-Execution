import type { Request, Response, NextFunction } from "express";
import { checkRateLimit } from "../monitoring/rateLimiter.js";
import { failure } from "../lib/utils.js";

type RouteLimit = { prefix: string; max: number; windowMs: number; key?: (req: Request) => string };

const ROUTE_LIMITS: RouteLimit[] = [
  { prefix: "/api/auth", max: 5, windowMs: 60_000, key: authEmailKey },
  { prefix: "/api/v1/validation", max: 5, windowMs: 60_000 },
  { prefix: "/api/v1/erector", max: 20, windowMs: 60_000 },
  { prefix: "/api/feedback", max: 30, windowMs: 60_000, key: sessionOrIpKey },
  { prefix: "/api/orders", max: 30, windowMs: 60_000, key: sessionOrIpKey },
  { prefix: "/api/uploads", max: 20, windowMs: 60 * 60_000, key: sessionOrIpKey },
  { prefix: "/api/external/upload", max: 20, windowMs: 60 * 60_000, key: sessionOrIpKey },
  { prefix: "/api/onboarding", max: 20, windowMs: 60_000 },
];

function authEmailKey(req: Request): string {
  const body = req.body as { email?: string } | undefined;
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  return email ? `auth:${email}` : `auth-ip:${req.ip ?? "unknown"}`;
}

function sessionOrIpKey(req: Request): string {
  const auth = (req as Request & { auth?: { userId?: string } }).auth;
  if (auth?.userId) return `user:${auth.userId}`;
  return `ip:${req.ip ?? "unknown"}`;
}

function generalKey(req: Request): string {
  return `api:${req.ip ?? "unknown"}`;
}

export async function apiRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const path = req.originalUrl.split("?")[0];

  for (const rule of ROUTE_LIMITS) {
    if (!path.startsWith(rule.prefix)) continue;
    const key = (rule.key ?? generalKey)(req);
    const allowed = await checkRateLimit(`${rule.prefix}:${key}`, rule.max, rule.windowMs);
    if (!allowed) {
      failure(res, "RATE_LIMITED", "Too many requests. Please try again later.", 429, {
        retryable: true,
      });
      return;
    }
    next();
    return;
  }

  const allowed = await checkRateLimit(`api:general:${generalKey(req)}`, 120, 60_000);
  if (!allowed) {
    failure(res, "RATE_LIMITED", "Too many requests. Please try again later.", 429, {
      retryable: true,
    });
    return;
  }

  next();
}

/** Magic link send: max 5 per email per hour */
export async function magicLinkHourlyLimit(email: string): Promise<boolean> {
  const key = `magic-hour:${email.toLowerCase().trim()}`;
  return checkRateLimit(key, 5, 60 * 60 * 1000);
}

/** Magic link verify: max 5 attempts per email per minute */
export async function magicLinkVerifyLimit(email: string): Promise<boolean> {
  const key = `magic-verify:${email.toLowerCase().trim()}`;
  return checkRateLimit(key, 5, 60_000);
}
