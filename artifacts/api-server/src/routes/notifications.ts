import { Router } from "express";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/notifications/history
router.get("/notifications/history", async (req, res) => {
  try {
    // TODO: Implement NotificationService in Prompt 14
    success(res, []);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
