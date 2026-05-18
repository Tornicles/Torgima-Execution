import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { runOvernightCycle } from "../workers/OvernightWorker.js";
import { runWorldStateUpdate } from "../workers/WorldStateWorker.js";
import { runCompressionCycle } from "../workers/CompressionWorker.js";

const router = Router();

router.post("/workers/trigger-overnight", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && !req.headers["x-internal-dev"]) {
      failure(res, "FORBIDDEN", "Overnight trigger is dev-only without x-internal-dev header", 403);
      return;
    }
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ userId: z.string().uuid().optional() }).parse(req.body ?? {});
    const userId = body.userId ?? auth.userId;
    const result = await runOvernightCycle(userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/workers/trigger-world-state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await runWorldStateUpdate(auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/workers/trigger-compression", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await runCompressionCycle(auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
