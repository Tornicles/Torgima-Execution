import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { blueprintIdFromQuery, requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { unifiedExecutor } from "../bhudhi/runtime/executors/UnifiedExecutor.js";

const router = Router();

const executionTypeSchema = z.enum(["decision", "simulation", "team", "organization", "task"]);

// POST /api/bhudhi/runtime/execute — unified execution runtime (Prompt 35)
router.post("/bhudhi/runtime/execute", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        executionType: executionTypeSchema,
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId, executionType, and payload required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await unifiedExecutor.execute(
      parsed.data.blueprintId,
      parsed.data.executionType,
      parsed.data.payload,
    );

    bhudhiSuccess(res, { success: true, execution: result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/execution/stats
router.get("/bhudhi/execution/stats", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);

    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const stats = await unifiedExecutor.getStats(blueprintId);
    bhudhiSuccess(res, { success: true, stats });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/runtime/history
router.get("/bhudhi/runtime/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;

    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const history = await unifiedExecutor.getHistory(blueprintId, limit);
    bhudhiSuccess(res, {
      success: true,
      executions: history,
      count: history.length,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/runtime/context
router.get("/bhudhi/runtime/context", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const executionId = typeof req.query.executionId === "string" ? req.query.executionId : undefined;
    const blueprintId = blueprintIdFromQuery(req);

    if (!executionId || !blueprintId) {
      failure(res, "VALIDATION_ERROR", "executionId and blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const context = await unifiedExecutor.getContext(executionId);
    if (!context || context.blueprintId !== blueprintId) {
      failure(res, "NOT_FOUND", "Execution not found", 404);
      return;
    }

    bhudhiSuccess(res, { success: true, context });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
