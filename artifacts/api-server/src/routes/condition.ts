import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { authMiddleware, requireFullMode } from "../middleware/auth.js";
import type { AuthContext } from "../types/auth.js";
import { success, failure } from "../lib/utils.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { ConditionService } from "../services/ConditionService.js";

const router = Router();

async function handleCurrentCondition(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  try {
    const auth = (req as import("express").Request & { auth: AuthContext }).auth;
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;

    const view = await ConditionService.getCurrent(auth.userId, blueprintId);
    if (!view) {
      success(res, { condition: null, enforcement: null });
      return;
    }

    success(res, {
      blueprintId: view.blueprintId,
      display: view.display,
      frameworkSignals: view.frameworkSignals,
      condition: view.condition,
      enforcement: view.enforcement,
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load condition", 500);
  }
}

router.get("/condition/current", authMiddleware, requireFullMode, handleCurrentCondition);
router.get("/conditions/current", authMiddleware, requireFullMode, handleCurrentCondition);

router.get("/condition/history", async (req, res): Promise<void> => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const result = await ConditionService.getHistory(auth.userId, { blueprintId, limit });
    if (!result) {
      success(res, { history: [] });
      return;
    }

    success(res, result);
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load condition history", 500);
  }
});

export default router;
