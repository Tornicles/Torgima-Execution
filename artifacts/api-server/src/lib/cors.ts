import type { Request, Response, NextFunction } from "express";

const PRODUCTION_ORIGINS = [
  "https://torgima-execution.vercel.app",
  "https://torgima.com",
] as const;

const ALLOW_METHODS = "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS";
const ALLOW_HEADERS =
  "Content-Type,Authorization,x-internal-auth,x-expected-state-version,idempotency-key,Cookie";
const MAX_AGE = "86400";

function parseFrontendOrigins(): string[] {
  return (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function devOrigins(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  return [
    `http://localhost:${process.env.FRONTEND_DEV_PORT ?? "5173"}`,
    `http://localhost:${process.env.APP_DEV_PORT ?? "3000"}`,
  ];
}

export function getAllowedOrigins(): string[] {
  return [...new Set([...parseFrontendOrigins(), ...PRODUCTION_ORIGINS, ...devOrigins()])];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  if (getAllowedOrigins().includes(normalized)) return true;
  if (normalized.endsWith(".vercel.app")) return true;
  if (normalized.includes("localhost")) return true;
  if (normalized.startsWith("http://127.0.0.1:")) return true;
  return false;
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
      // Unknown origin preflight — acknowledge without granting access.
      console.warn("[CORS] Blocked preflight from origin:", origin);
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
