import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { DashboardService } from "../services/DashboardService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/state/dashboard
router.get("/state/dashboard", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const state = await DashboardService.getDashboardState(auth.userId);
    success(res, state);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
