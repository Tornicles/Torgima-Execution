import { Router } from "express";
import { DashboardService } from "../services/DashboardService.js";
import { UserService } from "../services/UserService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/state/dashboard
router.get("/state/dashboard", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const state = await DashboardService.getDashboardState(user.id);
    success(res, state);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
