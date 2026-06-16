/**
 * DOC30 — session middleware, tier gates, dashboard mode, internal-only routes.
 */

import type { Request, Response, NextFunction } from "express";
import { withAuth } from "../lib/auth.js";
import { TorgimaError } from "../lib/errors.js";
import { failure } from "../lib/utils.js";
import { torgimaErrorToStatus, isTorgimaError } from "../lib/errors.js";
import type { AuthContext } from "../types/auth.js";

export const TIER_ORDER = {
  starter: 0,
  growth: 1,
  ultimate: 2,
} as const;

export type ProductTier = keyof typeof TIER_ORDER;

/** Routes that require dashboard_mode = full (execution active). */
export const FULL_MODE_ROUTES = [
  "/api/orders/current",
  "/api/orders/:id/start",
  "/api/orders/:id/feedback",
  "/api/signals/current",
  "/api/condition/current",
  "/api/rewards/current",
  "/api/outcomes/current",
  "/api/priority/current",
] as const;

export function normalizeProductTier(tier: string | undefined): ProductTier {
  const value = (tier ?? "starter").toLowerCase();
  if (value === "growth" || value === "ultimate") return value;
  return "starter";
}

export function tierMeetsMinimum(userTier: string | undefined, minTier: ProductTier): boolean {
  const current = TIER_ORDER[normalizeProductTier(userTier)];
  return current >= TIER_ORDER[minTier];
}

export function assertTierAccess(userTier: string | undefined, minTier: ProductTier): void {
  if (!tierMeetsMinimum(userTier, minTier)) {
    throw new TorgimaError(
      "TIER_INSUFFICIENT",
      `This feature requires ${minTier} tier or above.`,
    );
  }
}

export function assertFullDashboardMode(dashboardMode: string | undefined): void {
  if ((dashboardMode ?? "limited") !== "full") {
    throw new TorgimaError(
      "DASHBOARD_LIMITED",
      "Complete project validation to access execution features.",
    );
  }
}

function getAuth(req: Request): AuthContext | undefined {
  return (req as Request & { auth?: AuthContext }).auth;
}

function handleMiddlewareError(req: Request, res: Response, err: unknown): void {
  if (isTorgimaError(err)) {
    failure(res, err.code, err.message, torgimaErrorToStatus(err.code), {
      retryable: err.retryable,
      sessionExpired: err.code === "UNAUTHENTICATED",
    });
    return;
  }
  failure(res, "INTERNAL_ERROR", "Request failed", 500);
}

/** DOC30 — validates Supabase session and attaches req.auth. */
export const authMiddleware = withAuth("USER_SESSION");

/** DOC30 — optional session (public-ish probes). */
export const optionalAuthMiddleware = withAuth("OPTIONAL_SESSION");

/** DOC30 — worker/cron routes; rejects browser Origin + requires internal secret. */
export const internalOnlyMiddleware = withAuth("INTERNAL_SERVICE");

export function requireTier(minTier: ProductTier) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      failure(res, "UNAUTHENTICATED", "Authentication required", 401, { sessionExpired: true });
      return;
    }
    try {
      assertTierAccess(auth.userTier, minTier);
      next();
    } catch (err) {
      handleMiddlewareError(req, res, err);
    }
  };
}

export function requireFullMode(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    failure(res, "UNAUTHENTICATED", "Authentication required", 401, { sessionExpired: true });
    return;
  }
  try {
    assertFullDashboardMode(auth.dashboardMode);
    next();
  } catch (err) {
    handleMiddlewareError(req, res, err);
  }
}
