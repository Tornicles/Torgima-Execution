import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { PlatformUpgradeService } from "../services/PlatformUpgradeService.js";

const router = Router();

/** GET /api/upgrade/status */
router.get("/upgrade/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
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
