import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { logger } from "../lib/logger.js";
import { isLaunchMode, isAdvancedUpgradeGateEnabled } from "../lib/launch-mode.js";
import { PlatformUpgradeService } from "../services/PlatformUpgradeService.js";

const router = Router();

/**
 * Safe response returned for unauthenticated requests and as a fallback
 * on any error.  Never includes sensitive state.
 */
const UPGRADE_GUEST_RESPONSE = {
  authenticated: false,
  tier: "starter",
  mode: "individual",
  upgradeRequired: false,
  launchMode: true,
  // Legacy fields preserved for UpgradeGate.tsx backward compatibility
  requiresUpgrade: false,
  executionState: "NORMAL",
  firstLoginAfterUpgrade: false,
  archivedCounts: {},
  migrationApplied: true,
} as const;

/**
 * Build the authenticated fast-path response in launch mode.
 * Uses only the data already in the AuthContext — no extra DB round-trips.
 */
function buildLaunchModeResponse(
  tier: string,
  mode: string,
  launchMode: boolean,
) {
  return {
    authenticated: true,
    tier: tier || "starter",
    mode: mode || "individual",
    upgradeRequired: false,
    launchMode,
    requiresUpgrade: false,
    executionState: "NORMAL",
    firstLoginAfterUpgrade: false,
    archivedCounts: {},
    migrationApplied: true,
  };
}

/** GET /api/upgrade/status
 *
 * Returns the user's upgrade / execution state.
 *
 * ┌─ Unauthenticated ────────────────────────────────────────────────────────┐
 * │  200  { authenticated:false, tier:"starter", upgradeRequired:false, … }  │
 * └──────────────────────────────────────────────────────────────────────────┘
 * ┌─ Authenticated + LAUNCH_MODE=true or ENABLE_ADVANCED_UPGRADE_GATE=false ─┐
 * │  200  { authenticated:true, tier:<profile>, upgradeRequired:false, … }   │
 * │  No DB queries to upgrade tables — fast path only.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 * ┌─ Authenticated + advanced upgrade gate enabled ───────────────────────────┐
 * │  200  Full PlatformUpgradeService.getStatus() result                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * This route MUST NEVER return 500.  Any error falls back to guest defaults.
 * The frontend UpgradeGate calls this on every non-public page transition.
 */
router.get("/upgrade/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "OPTIONAL_SESSION");

    if (!auth.userId) {
      // Guest / unauthenticated — return starter defaults immediately.
      success(res, UPGRADE_GUEST_RESPONSE);
      return;
    }

    const launchMode = isLaunchMode();
    const advancedGate = isAdvancedUpgradeGateEnabled();

    if (launchMode || !advancedGate) {
      // Fast path: return profile-derived defaults without hitting upgrade tables.
      // This eliminates the "relation does not exist" errors during migration rollouts
      // and keeps login/dashboard rendering non-blocking.
      success(res, buildLaunchModeResponse(auth.userTier, auth.userMode, launchMode));
      return;
    }

    // Advanced path: full upgrade state from PlatformUpgradeService.
    // Only runs when LAUNCH_MODE=false AND ENABLE_ADVANCED_UPGRADE_GATE=true.
    const status = await PlatformUpgradeService.getStatus(auth.userId);
    success(res, {
      authenticated: true,
      tier: auth.userTier || "starter",
      mode: auth.userMode || "individual",
      upgradeRequired: status.requiresUpgrade,
      launchMode: false,
      ...status,
    });
  } catch (err) {
    // On ANY error: return guest defaults — never 500.
    // The upgrade gate must not block login or dashboard rendering under any condition.
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), path: req.path },
      "[upgrade/status] Error suppressed — returning guest defaults",
    );
    success(res, UPGRADE_GUEST_RESPONSE);
  }
});

/** GET /api/upgrade/archived */
router.get("/upgrade/archived", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const items = await PlatformUpgradeService.listArchivedSummary(auth.userId);
    success(res, { items });
  } catch (err) {
    handleError(req, res, err);
  }
});

/** POST /api/upgrade/acknowledge */
router.post("/upgrade/acknowledge", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    await PlatformUpgradeService.acknowledgeUpgradeScreen(auth.userId);
    success(res, { acknowledged: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
