import type { Request, Response, NextFunction } from "express";
import { PRODUCTION_FRONTEND_URL } from "../config/production.js";
import { logger } from "./logger.js";

const ALLOW_METHODS = "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS";
const ALLOW_HEADERS =
  "Content-Type,Authorization,x-internal-auth,x-internal-token,x-expected-state-version,idempotency-key,Cookie";
const MAX_AGE = "86400";

/** Production browser origins — primary domain plus Vercel during DNS transition. */
const ALLOWED_ORIGINS = [
  PRODUCTION_FRONTEND_URL,
  "https://torgima-execution.vercel.app",
];

function devOrigins(): string[] {
  return [
    PRODUCTION_FRONTEND_URL,
    `http://localhost:${process.env.FRONTEND_DEV_PORT ?? "5173"}`,
    `http://localhost:${process.env.APP_DEV_PORT ?? "3000"}`,
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ];
}

export function getAllowedOrigins(): string[] {
  if (process.env.NODE_ENV === "production") {
    return [...ALLOWED_ORIGINS];
  }
  return [...new Set(devOrigins())];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    return ALLOWED_ORIGINS.includes(normalized);
  }
  return getAllowedOrigins().includes(normalized);
}

/**
 * Single Express middleware that replaces the `cors` npm package.
 * Handles both normal requests (sets ACAO + credentials) and OPTIONS preflights
 * (responds immediately with 204 + all required preflight headers).
 */
export function createCorsMiddleware() {
  return function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    if (typeof origin === "string" && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");

      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", ALLOW_METHODS);
        res.setHeader("Access-Control-Allow-Headers", ALLOW_HEADERS);
        res.setHeader("Access-Control-Max-Age", MAX_AGE);
        res.setHeader("Content-Length", "0");
        res.statusCode = 204;
        res.end();
        return;
      }
    } else if (req.method === "OPTIONS") {
      logger.warn({ origin }, "[CORS] Blocked preflight from origin");
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}

/** Sets ACAO on every response path (including errors) for credentialed browser clients. */
export function applyCorsHeaders(
  req: { headers: { origin?: string } },
  res: { setHeader: (name: string, value: string) => void },
): void {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || !isAllowedOrigin(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

/** Full preflight headers for raw http.ServerResponse (used in degraded mode). */
export function applyPreflightHeaders(
  req: { headers: { origin?: string } },
  res: { setHeader: (name: string, value: string) => void },
): void {
  applyCorsHeaders(req, res);
  const origin = req.headers.origin;
  if (typeof origin !== "string" || !isAllowedOrigin(origin)) return;
  res.setHeader("Access-Control-Allow-Methods", ALLOW_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOW_HEADERS);
  res.setHeader("Access-Control-Max-Age", MAX_AGE);
}
