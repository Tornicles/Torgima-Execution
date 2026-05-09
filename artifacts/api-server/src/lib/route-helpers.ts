/**
 * Prompt 14 — Express equivalents of Next.js route helpers.
 * Centralises mutation guards, feature flags, and error mapping for handlers.
 */
import type { Request, Response } from "express";
import {
  getExpectedStateVersion as getExpectedStateVersionBase,
  getIdempotencyKey as getIdempotencyKeyBase,
  checkFeatureFlag,
  failure,
  handleError,
} from "./utils.js";
import { isTorgimaError, TorgimaError, torgimaErrorToStatus } from "./errors.js";

export { checkFeatureFlag };

export function getExpectedStateVersion(
  req: Request,
  body?: Record<string, unknown>,
): number | null {
  return getExpectedStateVersionBase(req, body);
}

export function getIdempotencyKey(
  req: Request,
  body?: Record<string, unknown>,
): string {
  return getIdempotencyKeyBase(req, body);
}

/** Require client-supplied idempotency (header or body). No auto: fallback. */
export function requireExplicitIdempotencyKey(
  req: Request,
  body: Record<string, unknown> | undefined,
): string {
  const header = req.headers["idempotency-key"];
  if (typeof header === "string" && header.trim().length > 0) return header.trim();
  const fromBody = body?.["idempotencyKey"];
  if (typeof fromBody === "string" && fromBody.trim().length > 0) return fromBody.trim();
  throw new TorgimaError("VALIDATION_ERROR", "idempotencyKey is required", false, {
    idempotencyKey: ["Provide Idempotency-Key header or idempotencyKey in body"],
  });
}

/**
 * Standard catch-all for route handlers — maps TorgimaError and legacy STALE_STATE string.
 */
export function handleRouteError(req: Request, res: Response, error: unknown): void {
  if (isTorgimaError(error)) {
    const status = torgimaErrorToStatus(error.code);
    failure(res, error.code, error.message, status, {
      fieldErrors: error.fieldErrors,
      retryable: error.retryable,
    });
    return;
  }

  if (error instanceof Error && error.message === "STALE_STATE") {
    failure(res, "STALE_STATE", "State changed — refresh and retry", 409);
    return;
  }

  handleError(req, res, error);
}
