import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { PlatformUpgradeService } from "../services/PlatformUpgradeService.js";

const router = Router();

/** GET /api/upgrade/status
 *
 * Returns the authenticated user's upgrade state.
 * Returns a safe default when the caller is not authenticated so the frontend
 * can always render the upgrade screen — even before login completes — without
 * triggering a CORS-blocked 500 error.
 */
router.get("/upgrade/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "OPTIONAL_SESSION");

    if (!auth.userId) {
      // Not authenticated — return a safe default instead of 401 or 500.
      // The frontend calls this route early in the session lifecycle so it must
      // never crash the page while the user is still logging in.
      success(res, {
        requiresUpgrade: false,
        executionState: "NORMAL",
        firstLoginAfterUpgrade: false,
        archivedCounts: {},
        migrationApplied: true,
      });
      return;
    }

    const status = await PlatformUpgradeService.getStatus(auth.userId);
    success(res, status);
  } catch (err) {
    handleError(req, res, err);
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
