import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { logger } from "../lib/logger.js";
import { PlatformUpgradeService } from "../services/PlatformUpgradeService.js";

const router = Router();

const UPGRADE_SAFE_DEFAULT = {
  requiresUpgrade: false,
  executionState: "NORMAL",
  firstLoginAfterUpgrade: false,
  archivedCounts: {},
  migrationApplied: true,
} as const;

/** GET /api/upgrade/status
 *
 * Returns the authenticated user's upgrade state.
 * Returns safe defaults when unauthenticated OR when any error occurs so the
 * frontend can always render without CORS-blocked 500 errors.
 * This route MUST NEVER return 500.
 */
router.get("/upgrade/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "OPTIONAL_SESSION");

    if (!auth.userId) {
      success(res, UPGRADE_SAFE_DEFAULT);
      return;
    }

    const status = await PlatformUpgradeService.getStatus(auth.userId);
    success(res, status);
  } catch (err) {
    // On ANY error (DB down, missing table, user not found, etc.) return safe
    // defaults instead of a 500.  The upgrade gate in the frontend must always
    // be able to render, even during login, DB maintenance, or schema rollouts.
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), path: req.path },
      "[upgrade/status] Error suppressed — returning safe defaults",
    );
    success(res, UPGRADE_SAFE_DEFAULT);
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
