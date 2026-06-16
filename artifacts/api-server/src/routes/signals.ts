import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { authMiddleware, requireFullMode } from "../middleware/auth.js";
import type { AuthContext } from "../types/auth.js";
import { success, failure } from "../lib/utils.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { SignalService } from "../services/SignalService.js";

const router = Router();

router.get("/signals/current", authMiddleware, requireFullMode, async (req, res) => {
  try {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;

    const view = await SignalService.getApiCurrent(auth.userId, blueprintId);
    if (!view.blueprint) {
      success(res, { signal: null, condition: null });
      return;
    }

    success(res, {
      frameworkSignals: view.frameworkSignals,
      conditionDisplay: view.conditionDisplay,
      signal: view.signal,
      condition: view.condition,
      teamSignal: view.teamSignal,
      mode: view.blueprint.mode,
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get signal", 500);
  }
});

router.get("/signals/framework", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    const recalc = req.query.recalc === "true";

    const result = await SignalService.getApiFramework(auth.userId, blueprintId, recalc);
    if (!result) {
      success(res, { frameworkSignals: null });
      return;
    }
    success(res, result);
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load framework signals", 500);
  }
});

router.get("/signals/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10) || 30, 90);
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

    const result = await SignalService.getApiHistory(auth.userId, blueprintId, limit, offset);
    if (!result) {
      success(res, { snapshots: [], blueprintId: null });
      return;
    }

    success(res, {
      snapshots: result.snapshots,
      total: result.total,
      hasMore: result.hasMore,
      blueprintId: result.blueprintId,
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load signal history", 500);
  }
});

export default router;
