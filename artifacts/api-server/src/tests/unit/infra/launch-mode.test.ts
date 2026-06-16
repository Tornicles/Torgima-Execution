/**
 * Launch Mode — unit tests for all feature-gate helpers and dependent systems.
 *
 * These tests verify that:
 *  1. Each launch-mode flag is read from process.env at call time.
 *  2. Flags default to a conservative (disabled) value when absent.
 *  3. The cloudflare-cron handler skips all jobs when LAUNCH_MODE=true.
 *  4. /api/upgrade/status returns appropriate fields in launch mode.
 *  5. Signal auto-bootstrap is gated behind ENABLE_SIGNAL_AUTO_BOOTSTRAP.
 *  6. The wrangler.toml declares the expected flags.
 *  7. cloudflare-runtime.ts passes the new flags through to process.env.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

// ---------------------------------------------------------------------------
// Helpers — save and restore env vars around each test
// ---------------------------------------------------------------------------

const ENV_KEYS = [
  "LAUNCH_MODE",
  "ENABLE_ADVANCED_UPGRADE_GATE",
  "ENABLE_BACKGROUND_BHUDHI",
  "ENABLE_TEAM_BOOTSTRAP",
  "ENABLE_SIGNAL_AUTO_BOOTSTRAP",
  "ENABLE_MAGIC_LINK_AUTH",
];

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = savedEnv[k];
    }
  }
});

// ---------------------------------------------------------------------------
// lib/launch-mode.ts — flag reader functions
// ---------------------------------------------------------------------------

describe("launch-mode helpers — isLaunchMode()", () => {
  it("returns false when LAUNCH_MODE is not set (conservative default)", async () => {
    const { isLaunchMode } = await import("../../../lib/launch-mode.js");
    expect(isLaunchMode()).toBe(false);
  });

  it('returns true when LAUNCH_MODE="true"', async () => {
    process.env.LAUNCH_MODE = "true";
    const { isLaunchMode } = await import("../../../lib/launch-mode.js");
    expect(isLaunchMode()).toBe(true);
  });

  it('returns true when LAUNCH_MODE="1"', async () => {
    process.env.LAUNCH_MODE = "1";
    const { isLaunchMode } = await import("../../../lib/launch-mode.js");
    expect(isLaunchMode()).toBe(true);
  });

  it('returns false when LAUNCH_MODE="false"', async () => {
    process.env.LAUNCH_MODE = "false";
    const { isLaunchMode } = await import("../../../lib/launch-mode.js");
    expect(isLaunchMode()).toBe(false);
  });
});

describe("launch-mode helpers — isAdvancedUpgradeGateEnabled()", () => {
  it("returns false when ENABLE_ADVANCED_UPGRADE_GATE is not set (safe default)", async () => {
    const { isAdvancedUpgradeGateEnabled } = await import("../../../lib/launch-mode.js");
    expect(isAdvancedUpgradeGateEnabled()).toBe(false);
  });

  it('returns true when ENABLE_ADVANCED_UPGRADE_GATE="true"', async () => {
    process.env.ENABLE_ADVANCED_UPGRADE_GATE = "true";
    const { isAdvancedUpgradeGateEnabled } = await import("../../../lib/launch-mode.js");
    expect(isAdvancedUpgradeGateEnabled()).toBe(true);
  });
});

describe("launch-mode helpers — isSignalAutoBootstrapEnabled()", () => {
  it("returns false when ENABLE_SIGNAL_AUTO_BOOTSTRAP is not set", async () => {
    const { isSignalAutoBootstrapEnabled } = await import("../../../lib/launch-mode.js");
    expect(isSignalAutoBootstrapEnabled()).toBe(false);
  });

  it('returns true when ENABLE_SIGNAL_AUTO_BOOTSTRAP="true"', async () => {
    process.env.ENABLE_SIGNAL_AUTO_BOOTSTRAP = "true";
    const { isSignalAutoBootstrapEnabled } = await import("../../../lib/launch-mode.js");
    expect(isSignalAutoBootstrapEnabled()).toBe(true);
  });
});

describe("launch-mode helpers — isBackgroundBhudhiEnabled()", () => {
  it("returns false when ENABLE_BACKGROUND_BHUDHI is not set", async () => {
    const { isBackgroundBhudhiEnabled } = await import("../../../lib/launch-mode.js");
    expect(isBackgroundBhudhiEnabled()).toBe(false);
  });

  it('returns true when ENABLE_BACKGROUND_BHUDHI="true"', async () => {
    process.env.ENABLE_BACKGROUND_BHUDHI = "true";
    const { isBackgroundBhudhiEnabled } = await import("../../../lib/launch-mode.js");
    expect(isBackgroundBhudhiEnabled()).toBe(true);
  });
});

describe("launch-mode helpers — isTeamBootstrapEnabled()", () => {
  it("returns false when ENABLE_TEAM_BOOTSTRAP is not set", async () => {
    const { isTeamBootstrapEnabled } = await import("../../../lib/launch-mode.js");
    expect(isTeamBootstrapEnabled()).toBe(false);
  });
});

describe("launch-mode helpers — isMagicLinkAuthEnabled()", () => {
  it("returns false when ENABLE_MAGIC_LINK_AUTH is not set", async () => {
    const { isMagicLinkAuthEnabled } = await import("../../../lib/launch-mode.js");
    expect(isMagicLinkAuthEnabled()).toBe(false);
  });

  it('returns false when ENABLE_MAGIC_LINK_AUTH="false"', async () => {
    process.env.ENABLE_MAGIC_LINK_AUTH = "false";
    const { isMagicLinkAuthEnabled } = await import("../../../lib/launch-mode.js");
    expect(isMagicLinkAuthEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wrangler.toml — must declare all required flags with correct defaults
// ---------------------------------------------------------------------------

describe("wrangler.toml — production flag declarations", () => {
  const wrangler = read("artifacts/api-server/wrangler.toml");

  it('declares LAUNCH_MODE="production" (full production mode)', () => {
    expect(wrangler).toMatch(/^LAUNCH_MODE\s*=\s*["']production["']/m);
  });

  it("declares EVENT_DISPATCH_CRON_ENABLED=true", () => {
    expect(wrangler).toMatch(/^EVENT_DISPATCH_CRON_ENABLED\s*=\s*["']?true["']?/m);
  });

  it("declares ENABLE_MAGIC_LINK_AUTH=false", () => {
    expect(wrangler).toMatch(/ENABLE_MAGIC_LINK_AUTH\s*=\s*["']?false["']?/);
  });

  it("declares ENABLE_ADVANCED_UPGRADE_GATE=false", () => {
    expect(wrangler).toMatch(/ENABLE_ADVANCED_UPGRADE_GATE\s*=\s*["']?false["']?/);
  });

  it("declares ENABLE_BACKGROUND_BHUDHI=false", () => {
    expect(wrangler).toMatch(/ENABLE_BACKGROUND_BHUDHI\s*=\s*["']?false["']?/);
  });

  it("declares ENABLE_TEAM_BOOTSTRAP=false", () => {
    expect(wrangler).toMatch(/ENABLE_TEAM_BOOTSTRAP\s*=\s*["']?false["']?/);
  });

  it("declares ENABLE_SIGNAL_AUTO_BOOTSTRAP=true", () => {
    expect(wrangler).toMatch(/^ENABLE_SIGNAL_AUTO_BOOTSTRAP\s*=\s*["']?true["']?/m);
  });
});

// ---------------------------------------------------------------------------
// cloudflare-runtime.ts — new flags must be in passthrough list
// ---------------------------------------------------------------------------

describe("cloudflare-runtime.ts — passthrough list includes launch-mode flags", () => {
  const src = read("artifacts/api-server/src/lib/cloudflare-runtime.ts");

  it("passes LAUNCH_MODE through to process.env", () => {
    expect(src).toContain('"LAUNCH_MODE"');
  });

  it("passes ENABLE_MAGIC_LINK_AUTH through to process.env", () => {
    expect(src).toContain('"ENABLE_MAGIC_LINK_AUTH"');
  });

  it("passes ENABLE_ADVANCED_UPGRADE_GATE through to process.env", () => {
    expect(src).toContain('"ENABLE_ADVANCED_UPGRADE_GATE"');
  });

  it("passes ENABLE_BACKGROUND_BHUDHI through to process.env", () => {
    expect(src).toContain('"ENABLE_BACKGROUND_BHUDHI"');
  });

  it("passes ENABLE_TEAM_BOOTSTRAP through to process.env", () => {
    expect(src).toContain('"ENABLE_TEAM_BOOTSTRAP"');
  });

  it("passes ENABLE_SIGNAL_AUTO_BOOTSTRAP through to process.env", () => {
    expect(src).toContain('"ENABLE_SIGNAL_AUTO_BOOTSTRAP"');
  });
});

// ---------------------------------------------------------------------------
// cloudflare-cron.ts — must skip all jobs when LAUNCH_MODE=true
// ---------------------------------------------------------------------------

describe("cloudflare-cron.ts — launch mode guard", () => {
  const src = read("artifacts/api-server/src/schedulers/cloudflare-cron.ts");

  it("imports isLaunchMode from launch-mode.js", () => {
    expect(src).toContain("isLaunchMode");
    expect(src).toContain("launch-mode");
  });

  it("returns early when launch mode is active", () => {
    expect(src).toContain("isLaunchMode()");
    const launchIdx = src.indexOf("isLaunchMode()");
    const returnIdx = src.indexOf("return;", launchIdx);
    expect(returnIdx).toBeGreaterThan(launchIdx);
    expect(returnIdx - launchIdx).toBeLessThan(400);
  });

  it("logs a message when skipping in launch mode", () => {
    expect(src).toContain("LAUNCH_MODE=true");
  });
});

// ---------------------------------------------------------------------------
// routes/upgrade.ts — launch mode fast path and response shape
// ---------------------------------------------------------------------------

describe("routes/upgrade.ts — launch mode fast path", () => {
  const src = read("artifacts/api-server/src/routes/upgrade.ts");

  it("imports isLaunchMode and isAdvancedUpgradeGateEnabled", () => {
    expect(src).toContain("isLaunchMode");
    expect(src).toContain("isAdvancedUpgradeGateEnabled");
  });

  it("returns starter defaults for unauthenticated requests (UPGRADE_GUEST_RESPONSE)", () => {
    expect(src).toContain("UPGRADE_GUEST_RESPONSE");
    expect(src).toContain("authenticated: false");
    expect(src).toContain('tier: "starter"');
    expect(src).toContain('mode: "individual"');
    expect(src).toContain("upgradeRequired: false");
    expect(src).toContain("launchMode: true");
  });

  it("fast-path skips DB upgrade queries in launch mode or when advanced gate is disabled", () => {
    expect(src).toContain("buildLaunchModeResponse");
    const fastPathIdx = src.indexOf("if (launchMode || !advancedGate)");
    expect(fastPathIdx).toBeGreaterThan(-1);
  });

  it("uses auth.userTier and auth.userMode (no extra DB round-trip) in fast path", () => {
    // The call-site passes auth.userTier and auth.userMode to buildLaunchModeResponse
    expect(src).toContain("buildLaunchModeResponse(auth.userTier, auth.userMode");
  });

  it("only runs advanced PlatformUpgradeService queries when both flags off", () => {
    expect(src).toContain("PlatformUpgradeService.getStatus");
    // The service call must be guarded behind the launch mode check
    expect(src).toContain("if (launchMode || !advancedGate)");
    // Verify the service call appears after the guard in the file
    const launchCheckIdx = src.indexOf("if (launchMode || !advancedGate)");
    const serviceCallIdx = src.lastIndexOf("PlatformUpgradeService.getStatus");
    expect(serviceCallIdx).toBeGreaterThan(launchCheckIdx);
  });

  it("catch block returns UPGRADE_GUEST_RESPONSE — never 500", () => {
    const catchIdx = src.indexOf("} catch (err)");
    expect(catchIdx).toBeGreaterThan(-1);
    // Use large window — logger.warn() comes before the success() call
    const catchBlock = src.slice(catchIdx, catchIdx + 500);
    expect(catchBlock).toContain("UPGRADE_GUEST_RESPONSE");
  });
});

// ---------------------------------------------------------------------------
// services/BlueprintLaunchService.ts — signal bootstrap gated
// ---------------------------------------------------------------------------

describe("BlueprintLaunchService.ts — signal auto-bootstrap gate", () => {
  const src = read("artifacts/api-server/src/services/BlueprintLaunchService.ts");

  it("imports isSignalAutoBootstrapEnabled from launch-mode", () => {
    expect(src).toContain("isSignalAutoBootstrapEnabled");
    expect(src).toContain("launch-mode");
  });

  it("wraps initializePermanentFrameworkSignals in the signal gate", () => {
    const gateIdx = src.indexOf("isSignalAutoBootstrapEnabled()");
    expect(gateIdx).toBeGreaterThan(-1);
    const gateBlock = src.slice(gateIdx, gateIdx + 200);
    expect(gateBlock).toContain("initializePermanentFrameworkSignals");
  });
});

// ---------------------------------------------------------------------------
// Auth route — /api/auth/session isolation (no upgrade/status coupling)
// ---------------------------------------------------------------------------

describe("routes/auth.ts — session isolation", () => {
  const src = read("artifacts/api-server/src/routes/auth.ts");

  it("/api/auth/session never calls upgrade/status", () => {
    const sessionIdx = src.indexOf('router.get("/session"');
    expect(sessionIdx).toBeGreaterThan(-1);
    const sessionBlock = src.slice(sessionIdx, sessionIdx + 800);
    expect(sessionBlock).not.toContain("upgrade/status");
    expect(sessionBlock).not.toContain("PlatformUpgradeService");
    expect(sessionBlock).not.toContain("BlueprintLaunch");
  });

  it("/api/auth/session uses OPTIONAL_SESSION so missing token returns 200 authenticated:false", () => {
    const sessionIdx = src.indexOf('router.get("/session"');
    const sessionBlock = src.slice(sessionIdx, sessionIdx + 800);
    expect(sessionBlock).toContain('"OPTIONAL_SESSION"');
    expect(sessionBlock).toContain("authenticated: false");
  });

  it("session route uses handleError for sync failures; unauthenticated only when no token", () => {
    const sessionIdx = src.indexOf('router.get("/session"');
    const sessionEnd = src.indexOf('router.post("/sign-out"');
    const sessionBlock = src.slice(sessionIdx, sessionEnd);
    expect(sessionBlock).toContain("authenticated: false");
    expect(sessionBlock).toContain("handleError(req, res, err)");
  });
});

// ---------------------------------------------------------------------------
// Signup flow — frontend does not call any TORGIMA API routes
// ---------------------------------------------------------------------------

describe("pages/signup.tsx — signup isolation", () => {
  const src = read("artifacts/torgima/src/pages/signup.tsx");

  it("uses supabase.auth.signUp (Supabase handles user creation)", () => {
    expect(src).toContain("supabase.auth.signUp");
  });

  it("does not call /api/upgrade/status on signup", () => {
    expect(src).not.toContain("/api/upgrade/status");
  });

  it("does not call /api/auth/session on signup", () => {
    expect(src).not.toContain("/api/auth/session");
  });

  it("does not call blueprint, validation, or orders APIs on signup", () => {
    expect(src).not.toContain("/api/blueprints");
    expect(src).not.toContain("/api/validation");
    expect(src).not.toContain("/api/orders");
  });

  it("navigates to /onboarding after immediate signup (no email confirm)", () => {
    expect(src).toContain("/onboarding");
  });
});

// ---------------------------------------------------------------------------
// UpgradeGate — caching and launch-mode-aware behavior
// ---------------------------------------------------------------------------

describe("UpgradeGate.tsx — caching and launch mode", () => {
  const src = read("artifacts/torgima/src/components/UpgradeGate.tsx");

  it("caches the upgrade status result to avoid a spinner on every navigation", () => {
    expect(src).toContain("cachedStatus");
    expect(src).toContain("getCached");
    expect(src).toContain("setCache");
  });

  it("uses the cache for launch mode responses (stable for the session)", () => {
    expect(src).toContain("launchMode");
  });

  it("skips the API call and shows no spinner for public paths", () => {
    // The useEffect must contain: if (isPublicPath) { setChecking(false); return; }
    // Find the useEffect body (not the useState initializer)
    const useEffectIdx = src.indexOf("useEffect(() => {");
    expect(useEffectIdx).toBeGreaterThan(-1);
    const effectBody = src.slice(useEffectIdx, useEffectIdx + 400);
    expect(effectBody).toContain("isPublicPath(location)");
    expect(effectBody).toContain("setChecking(false)");
  });

  it("checks both requiresUpgrade and upgradeRequired for backward compat", () => {
    expect(src).toContain("requiresUpgrade");
    expect(src).toContain("upgradeRequired");
  });
});
