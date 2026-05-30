import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { buildErectorDashboard } from "../lib/buildErectorDashboard.js";

const router = Router();

/** GET /api/erector/dashboard — Reality & Preparation layer home data */
router.get("/erector/dashboard", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const panels = await buildErectorDashboard(auth.userId);
    success(res, { panels });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
