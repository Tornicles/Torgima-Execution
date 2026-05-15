import { randomUUID } from "crypto";
import { type Request, type Response } from "express";
import { db, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TorgimaError, torgimaErrorToStatus, isTorgimaError } from "./errors.js";
import { logger } from "./logger.js";

export function generateId(): string {
  return randomUUID();
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    retryable?: boolean;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

export function success<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = {
    ok: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  };
  res.status(status).json(body);
}

export function failure(
  res: Response,
  code: string,
  message: string,
  status = 500,
  opts?: { fieldErrors?: Record<string, string[]>; retryable?: boolean },
): void {
  const body: ApiResponse = {
    ok: false,
    error: { code, message, ...opts },
    meta: { timestamp: new Date().toISOString() },
  };
  res.status(status).json(body);
}

function mapInfrastructureFailure(err: unknown): {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
} | null {
  if (err == null) return null;

  const parts: { code: string; message: string }[] = [];
  const visit = (e: unknown): void => {
    if (!e || typeof e !== "object") return;
    const o = e as Record<string, unknown>;
    const code = o["code"];
    const msg = o["message"];
    if (typeof code === "string" || typeof code === "number") {
      parts.push({ code: String(code), message: typeof msg === "string" ? msg : "" });
    } else if (typeof msg === "string") {
      parts.push({ code: "", message: msg });
    }
    if ("cause" in o && o["cause"] != null) visit(o["cause"]);
  };
  visit(err);

  const combinedMsg = parts
    .map((p) => p.message)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const codes = new Set(parts.map((p) => p.code).filter(Boolean));

  const nodeNet = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"]);
  for (const c of codes) {
    if (nodeNet.has(c)) {
      return {
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message:
          "Cannot reach the database (network). On Railway, confirm DATABASE_URL is set to your Postgres connection string (pooler URLs often need ?sslmode=require for remote hosts).",
        retryable: true,
      };
    }
  }

  for (const c of codes) {
    if (/^[0-9A-Z]{5}$/.test(c)) {
      if (c.startsWith("08") || c === "57P01" || c === "57P03" || c === "28P01" || c === "3D000") {
        return {
          status: 503,
          code: "SERVICE_UNAVAILABLE",
          message:
            "Database rejected the connection or credentials. Double-check DATABASE_URL on the API host and that the database accepts connections from Railway.",
          retryable: true,
        };
      }
    }
  }

  if (
    combinedMsg.includes("column") && combinedMsg.includes("does not exist") ||
    combinedMsg.includes("type") && combinedMsg.includes("does not exist") ||
    combinedMsg.includes("validation_readiness") ||
    combinedMsg.includes("launch_blocked") ||
    combinedMsg.includes("eis_rate_limits")
  ) {
    return {
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message:
        "The database schema is out of date. Redeploy the API server (it applies patches on boot) or run scripts/migrations/*.sql on your Postgres instance.",
      retryable: true,
    };
  }

  if (
    combinedMsg.includes("password authentication failed") ||
    combinedMsg.includes("no pg_hba.conf") ||
    combinedMsg.includes("connection terminated") ||
    combinedMsg.includes("server closed the connection") ||
    combinedMsg.includes("ssl") ||
    combinedMsg.includes("certificate") ||
    combinedMsg.includes("self signed") ||
    combinedMsg.includes("timeout") ||
    combinedMsg.includes("connect econnrefused") ||
    combinedMsg.includes("getaddrinfo")
  ) {
    return {
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message:
        "Sign-in service cannot talk to the database. Fix DATABASE_URL / SSL on Railway, redeploy the API, then try again.",
      retryable: true,
    };
  }

  return null;
}

export function handleError(req: Request, res: Response, err: unknown): void {
  if (isTorgimaError(err)) {
    const status = torgimaErrorToStatus(err.code);
    failure(res, err.code, err.message, status, {
      fieldErrors: err.fieldErrors,
      retryable: err.retryable,
    });
    return;
  }

  const infra = mapInfrastructureFailure(err);
  if (infra) {
    req.log.error({ err }, "Infrastructure error in route handler");
    failure(res, infra.code, infra.message, infra.status, { retryable: infra.retryable });
    return;
  }

  req.log.error({ err }, "Unhandled error in route handler");
  failure(res, "INTERNAL_ERROR", "An unexpected error occurred", 500);
}

export function requireParam(
  params: Record<string, string | undefined>,
  name: string,
): string {
  const val = params[name];
  if (!val) throw new TorgimaError("VALIDATION_ERROR", `Missing param: ${name}`);
  return val;
}

export function now(): string {
  return new Date().toISOString();
}

// ── ROUTE HELPERS (Prompt 1 §lib/route-helpers) ────────────────────────────
// All mutating routes must accept either an `x-expected-state-version` header
// or `expectedStateVersion` body field, and either an `idempotency-key` header
// or `idempotencyKey` body field. Helpers below normalise both lookups.

export function getExpectedStateVersion(
  req: Request,
  body?: Record<string, unknown>,
): number | null {
  const header = req.headers["x-expected-state-version"];
  if (typeof header === "string" && header.trim().length > 0) {
    const parsed = parseInt(header, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const fromBody = body?.["expectedStateVersion"];
  if (typeof fromBody === "number") return fromBody;
  if (typeof fromBody === "string" && fromBody.trim().length > 0) {
    const parsed = parseInt(fromBody, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function getIdempotencyKey(
  req: Request,
  body?: Record<string, unknown>,
): string {
  const header = req.headers["idempotency-key"];
  if (typeof header === "string" && header.trim().length > 0) return header;
  const fromBody = body?.["idempotencyKey"];
  if (typeof fromBody === "string" && fromBody.trim().length > 0) return fromBody;
  return `auto:${req.method}:${req.originalUrl}:${Date.now()}`;
}

// Reads a feature flag from the `feature_flags` table. Errors fall back to
// `false` so a transient DB hiccup never silently enables a gated capability.
export async function checkFeatureFlag(flagName: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.feature_name, flagName))
      .limit(1);
    return rows[0]?.enabled ?? false;
  } catch (err) {
    logger.warn(
      { flagName, err: err instanceof Error ? err.message : String(err) },
      "[checkFeatureFlag] Lookup failed — defaulting to disabled",
    );
    return false;
  }
}
