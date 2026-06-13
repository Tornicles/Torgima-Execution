/**
 * Post-signup auth handoff — verifies session/profile/onboarding isolation.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("lib/auth.ts — Supabase profile sync", () => {
  const src = read("artifacts/api-server/src/lib/auth.ts");

  it("resolves profile by supabase_id first, then email, then legacy id", () => {
    expect(src).toContain("eq(users.supabase_id, supabaseId)");
    expect(src).toContain("eq(users.email, normalizedEmail)");
    expect(src).toContain("eq(users.id, supabaseId)");
    const resolveIdx = src.indexOf("async function resolveUserFromSupabase");
    const resolveBlock = src.slice(resolveIdx, resolveIdx + 1200);
    const supabaseIdx = resolveBlock.indexOf("eq(users.supabase_id, supabaseId)");
    const emailIdx = resolveBlock.indexOf("eq(users.email, normalizedEmail)");
    const idIdx = resolveBlock.indexOf("eq(users.id, supabaseId)");
    expect(supabaseIdx).toBeGreaterThan(-1);
    expect(emailIdx).toBeGreaterThan(supabaseIdx);
    expect(idIdx).toBeGreaterThan(emailIdx);
  });

  it("creates profile with id = supabaseId (preferred mapping)", () => {
    expect(src).toContain("id: supabaseId");
  });

  it("links legacy email profile instead of duplicating", () => {
    expect(src).toContain("resolveUserFromSupabase(supabaseId, normalizedEmail)");
    const createIdx = src.indexOf("async function createUserFromSupabase");
    const createBlock = src.slice(createIdx, createIdx + 800);
    expect(createBlock).toContain("if (existing)");
  });

  it("uses launch-mode JWT passthrough when profile DB lookup fails", () => {
    expect(src).toContain("isLaunchMode()");
    expect(src).toContain("Profile DB lookup failed — Supabase JWT passthrough (degraded)");
    expect(src).toContain("buildDegradedSupabaseJwtContext");
  });
});

describe("routes/auth.ts — /api/auth/session resilience", () => {
  const src = read("artifacts/api-server/src/routes/auth.ts");

  it("returns authenticated:false when no token (OPTIONAL_SESSION)", () => {
    const sessionIdx = src.indexOf('router.get("/session"');
    const sessionBlock = src.slice(sessionIdx, sessionIdx + 1200);
    expect(sessionBlock).toContain("authenticated: false");
    expect(sessionBlock).toContain('"OPTIONAL_SESSION"');
  });

  it("falls back to minimal profile when getUser fails", () => {
    expect(src).toContain("getUser failed — returning minimal profile from auth context");
    expect(src).toContain("onboardingComplete: false");
  });

  it("uses handleError for profile sync failures (not silent authenticated:false)", () => {
    const sessionIdx = src.indexOf('router.get("/session"');
    const sessionEnd = src.indexOf("router.post(\"/sign-out\"");
    const sessionBlock = src.slice(sessionIdx, sessionEnd);
    expect(sessionBlock).toContain("handleError(req, res, err)");
    expect(sessionBlock).not.toMatch(/catch\s*\{\s*success\(res,\s*\{\s*authenticated:\s*false/);
  });

  it("never calls upgrade or blueprint logic", () => {
    const sessionIdx = src.indexOf('router.get("/session"');
    const sessionEnd = src.indexOf("router.post(\"/sign-out\"");
    const sessionBlock = src.slice(sessionIdx, sessionEnd);
    expect(sessionBlock).not.toContain("PlatformUpgradeService");
    expect(sessionBlock).not.toContain("BlueprintLaunch");
  });
});

describe("frontend — post-signup handoff", () => {
  it("AuthProvider initializes session and syncs profile", () => {
    const src = read("artifacts/torgima/src/providers/AuthProvider.tsx");
    expect(src).toContain("supabase.auth.getSession()");
    expect(src).toContain("onAuthStateChange");
    expect(src).toContain("loading");
    expect(src).toContain("accessToken");
    expect(src).toContain("isAuthenticated");
    expect(src).toContain("setFallbackSession");
  });

  it("useSessionGuard waits for auth loading before redirect", () => {
    const src = read("artifacts/torgima/src/hooks/useSessionGuard.ts");
    expect(src).toContain("useAuth");
    expect(src).toContain("if (loading) return");
    expect(src).toContain("!isAuthenticated");
    expect(src).not.toContain("fetchTorgimaProfile");
  });

  it("signup routes to check-email when no session (email confirmation)", () => {
    const src = read("artifacts/torgima/src/pages/signup.tsx");
    expect(src).toContain("/signup/check-email");
    expect(src).toContain("data.session?.access_token");
    expect(src).toContain("/onboarding");
  });

  it("check-email page exists and does not call protected APIs", () => {
    const src = read("artifacts/torgima/src/pages/signup/check-email.tsx");
    expect(src).toContain("Check your email");
    expect(src).not.toContain("/api/");
  });

  it("api client does not redirect on 401 when Supabase token exists", () => {
    const src = read("artifacts/torgima/src/api/client.ts");
    expect(src).toContain("if (!getAuthToken())");
    expect(src).toContain("redirectToLogin()");
  });

  it("App wraps routes with AuthProvider", () => {
    const src = read("artifacts/torgima/src/App.tsx");
    expect(src).toContain("AuthProvider");
    expect(src).toContain("/signup/check-email");
  });
});

describe("routes/debug.ts — auth-flow diagnostic", () => {
  const src = read("artifacts/api-server/src/routes/debug.ts");

  it("defines GET /api/debug/auth-flow", () => {
    expect(src).toContain('router.get("/debug/auth-flow"');
    expect(src).toContain("probeSupabaseAuthToken");
    expect(src).toContain("launchMode");
    expect(src).not.toContain("access_token");
  });
});
