/**
 * DOC30 — GET /api/auth/session response contract.
 */

import type { AuthContext } from "../types/auth.js";
import type { SafeUser } from "../types/auth.js";

export type SessionUserContract = {
  id: string;
  email: string;
  tier: "starter" | "growth" | "ultimate";
  dashboard_mode: "limited" | "full";
  erector_tier: "free" | "pro" | "authenticated" | null;
  has_active_blueprint: boolean;
  blueprint_id: string | null;
};

export type SessionResponse = {
  user: SessionUserContract;
  expires_at: string;
};

const ERECTOR_TIERS = new Set(["free", "pro", "authenticated"]);

function normalizeErectorTier(value: string | null | undefined): SessionUserContract["erector_tier"] {
  const tier = (value ?? "").toLowerCase();
  if (ERECTOR_TIERS.has(tier)) {
    return tier as SessionUserContract["erector_tier"];
  }
  return null;
}

function normalizeProductTier(tier: string | undefined): SessionUserContract["tier"] {
  const value = (tier ?? "starter").toLowerCase();
  if (value === "growth" || value === "ultimate") return value;
  return "starter";
}

function normalizeDashboardMode(value: string | undefined): "limited" | "full" {
  return value === "full" ? "full" : "limited";
}

/** Build DOC30 session payload from auth context + optional profile row. */
export function buildSessionResponse(
  auth: AuthContext,
  profile?: SafeUser | null,
  expiresAt?: Date,
): SessionResponse {
  const blueprintId = profile?.activeBlueprintId ?? null;
  return {
    user: {
      id: auth.userId,
      email: auth.email ?? profile?.email ?? "",
      tier: normalizeProductTier(auth.userTier ?? profile?.tier),
      dashboard_mode: normalizeDashboardMode(auth.dashboardMode ?? profile?.dashboardMode),
      erector_tier: normalizeErectorTier(auth.erectorTier ?? profile?.erectorTier),
      has_active_blueprint: Boolean(blueprintId),
      blueprint_id: blueprintId,
    },
    expires_at: (expiresAt ?? new Date(Date.now() + 60 * 60 * 1000)).toISOString(),
  };
}
