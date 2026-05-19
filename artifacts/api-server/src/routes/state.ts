import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { DashboardService } from "../services/DashboardService.js";
import { success, handleError } from "../lib/utils.js";
import { refreshDashboardIntelligence } from "../engines/dashboard/DashboardIntelligenceEngine.js";

const router = Router();

// GET /api/state/dashboard — aligns with OpenAPI DashboardState via DashboardService
router.get("/state/dashboard", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const payload = await DashboardService.getDashboardState(auth.userId);
    success(res, payload);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/state/dashboard-intelligence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const payload = await refreshDashboardIntelligence(auth.userId, "SESSION_START");
    success(res, payload);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
