import type { CorsOptions } from "cors";

const PRODUCTION_ORIGINS = [
  "https://torgima-execution.vercel.app",
  "https://torgima.com",
] as const;

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

export function buildCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      console.warn("[CORS] Blocked origin:", origin);
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-internal-auth",
      "x-expected-state-version",
      "idempotency-key",
      "Cookie",
    ],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 204,
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
