import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TIER_ORDER,
  FULL_MODE_ROUTES,
  tierMeetsMinimum,
  assertTierAccess,
  assertFullDashboardMode,
  normalizeProductTier,
} from "../../../middleware/auth.js";
import { buildSessionResponse } from "../../../lib/session-contract.js";
import { TorgimaError } from "../../../lib/errors.js";
import type { AuthContext } from "../../../types/auth.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("DOC 30 — Authentication & Session Management", () => {
  it("validates production auth env on boot", () => {
    const index = readRepo("artifacts/api-server/src/index.ts");
    expect(index).toContain("assertAuthEnvOnBoot");
  });

  it("uses magic_link_tokens and 15-minute expiry in AuthService", () => {
    const auth = readRepo("artifacts/api-server/src/services/AuthService.ts");
    expect(auth).toContain("magicLinkTokens");
    expect(auth).toContain("MAGIC_LINK_EXPIRY_MINUTES = 15");
    expect(auth).toContain("SESSION_IDLE_MS");
  });

  it("resolves APP_URL for post-verify SPA redirects", () => {
    const appUrl = readRepo("artifacts/api-server/src/lib/app-url.ts");
    expect(appUrl).toContain('process.env["APP_URL"]');
  });

  it("uses SPA auth callback URL in magic-link emails", () => {
    const auth = readRepo("artifacts/api-server/src/services/AuthService.ts");
    const apiUrl = readRepo("artifacts/api-server/src/lib/api-url.ts");
    expect(auth).toContain("buildMagicLinkVerifyUrl");
    expect(apiUrl).toContain("/auth/callback");
    expect(apiUrl).toContain("resolveAppUrl");
  });

  it("registers session cleanup worker at 02:00 UTC", () => {
    const worker = readRepo("artifacts/api-server/src/workers/SessionCleanupWorker.ts");
    expect(worker).toContain("0 2 * * *");
    expect(worker).toContain("session-cleanup");
    const start = readRepo("artifacts/api-server/src/workers/start.ts");
    expect(start).toContain("SessionCleanupWorker");
    expect(start).toContain("startSessionCleanupSchedule");
  });

  it("logs browser internal route attempts", () => {
    const authLib = readRepo("artifacts/api-server/src/lib/auth.ts");
    expect(authLib).toContain("BROWSER_INTERNAL_ROUTE_ATTEMPT");
    expect(authLib).toContain("logAuthSecurityEvent");
  });

  it("exposes ownership guard helpers", () => {
    const guards = readRepo("artifacts/api-server/src/lib/ownership-guards.ts");
    expect(guards).toContain("requireBlueprintOwnership");
    expect(guards).toContain("requireOrderOwnership");
    expect(guards).toContain("requireFeedbackOwnership");
  });

  it("returns sessionExpired on auth errors", () => {
    const utils = readRepo("artifacts/api-server/src/lib/utils.ts");
    expect(utils).toContain("sessionExpired");
  });
});

describe("auth", () => {
  it("defines tier order starter < growth < ultimate", () => {
    expect(TIER_ORDER.starter).toBeLessThan(TIER_ORDER.growth);
    expect(TIER_ORDER.growth).toBeLessThan(TIER_ORDER.ultimate);
  });

  it("blocks starter from growth-tier features", () => {
    expect(tierMeetsMinimum("starter", "growth")).toBe(false);
    expect(() => assertTierAccess("starter", "growth")).toThrow(TorgimaError);
    try {
      assertTierAccess("starter", "growth");
    } catch (err) {
      expect((err as TorgimaError).code).toBe("TIER_INSUFFICIENT");
    }
  });

  it("allows growth and ultimate for growth-tier features", () => {
    expect(tierMeetsMinimum("growth", "growth")).toBe(true);
    expect(tierMeetsMinimum("ultimate", "growth")).toBe(true);
    expect(() => assertTierAccess("growth", "growth")).not.toThrow();
  });

  it("blocks limited dashboard mode from execution routes", () => {
    expect(() => assertFullDashboardMode("limited")).toThrow(TorgimaError);
    try {
      assertFullDashboardMode("limited");
    } catch (err) {
      expect((err as TorgimaError).code).toBe("DASHBOARD_LIMITED");
    }
    expect(() => assertFullDashboardMode("full")).not.toThrow();
  });

  it("lists full-mode execution routes", () => {
    expect(FULL_MODE_ROUTES).toContain("/api/orders/current");
    expect(FULL_MODE_ROUTES).toContain("/api/signals/current");
    expect(FULL_MODE_ROUTES).toContain("/api/rewards/current");
  });

  it("builds DOC30 session contract from auth context", () => {
    const auth: AuthContext = {
      userId: "user-1",
      sessionId: "supabase-jwt",
      userMode: "individual",
      userTier: "growth",
      isInternal: false,
      email: "founder@example.com",
      dashboardMode: "full",
      erectorTier: "authenticated",
    };
    const session = buildSessionResponse(auth, {
      id: "user-1",
      email: "founder@example.com",
      displayName: null,
      mode: "individual",
      tier: "growth",
      onboardingComplete: true,
      executionState: "NORMAL",
      firstLoginAfterUpgrade: false,
      activeBlueprintId: "bp-1",
      timezone: "UTC",
      notificationPreferences: {},
      dashboardMode: "full",
      erectorTier: "authenticated",
    });

    expect(session.user.id).toBe("user-1");
    expect(session.user.email).toBe("founder@example.com");
    expect(session.user.tier).toBe("growth");
    expect(session.user.dashboard_mode).toBe("full");
    expect(session.user.erector_tier).toBe("authenticated");
    expect(session.user.has_active_blueprint).toBe(true);
    expect(session.user.blueprint_id).toBe("bp-1");
    expect(session.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("normalizes unknown tiers to starter", () => {
    expect(normalizeProductTier(undefined)).toBe("starter");
    expect(normalizeProductTier("enterprise")).toBe("starter");
  });

  it("wires middleware module and Supabase getUser verification", () => {
    const middleware = readRepo("artifacts/api-server/src/middleware/auth.ts");
    expect(middleware).toContain("authMiddleware");
    expect(middleware).toContain("requireTier");
    expect(middleware).toContain("requireFullMode");
    expect(middleware).toContain("internalOnlyMiddleware");

    const supabase = readRepo("artifacts/api-server/src/lib/supabase.ts");
    expect(supabase).toContain("getUser");

    const sessionRoute = readRepo("artifacts/api-server/src/routes/auth.ts");
    const sessionContract = readRepo("artifacts/api-server/src/lib/session-contract.ts");
    expect(sessionRoute).toContain("buildSessionResponse");
    expect(sessionContract).toContain("expires_at");
  });
});
