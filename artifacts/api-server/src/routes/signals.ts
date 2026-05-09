import { Router } from "express";
import { SignalService } from "../services/SignalService.js";
import { UserService } from "../services/UserService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/signals/current
router.get("/signals/current", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const signals = await SignalService.getCurrent(user.id);
    success(res, signals);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/signals/history
router.get("/signals/history", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const history = await SignalService.getHistory(user.id);
    success(res, history);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
