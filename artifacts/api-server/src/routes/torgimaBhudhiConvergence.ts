import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { convergenceLayer } from "../bhudhi/convergence/ConvergenceLayer.js";

const router = Router();

const blueprintBody = z.object({
  blueprintId: z.string().uuid(),
  createOrder: z.boolean().optional(),
  syncRecommendations: z.boolean().optional(),
});

const feedbackBody = z.object({
  blueprintId: z.string().uuid(),
  orderId: z.string().uuid(),
  feedback: z.record(z.string(), z.unknown()).optional(),
});

/** GET /api/torgima/bhudhi/state?blueprintId= */
router.get("/torgima/bhudhi/state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().safeParse(req.query.blueprintId);
    if (!blueprintId.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId.data, auth.userId);
    if (!ok) return;

    const state = await convergenceLayer.getUnifiedState(blueprintId.data);
    if (!state) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    bhudhiSuccess(res, {
      success: true,
      state,
      insight: "Unified Torgima execution + Bhudhi intelligence snapshot",
      nextSteps: [
        "POST /api/torgima/bhudhi/execute to run convergence cycle",
        "POST /api/torgima/bhudhi/feedback after order completion",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

/** POST /api/torgima/bhudhi/execute */
router.post("/torgima/bhudhi/execute", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = blueprintBody.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await convergenceLayer.executeGoal(parsed.data.blueprintId, {
      createOrder: parsed.data.createOrder ?? false,
      syncRecommendations: parsed.data.syncRecommendations ?? false,
    });

    bhudhiSuccess(res, {
      success: result.intelligence.status === "completed",
      result,
      insight:
        result.intelligence.status === "completed"
          ? "Bhudhi cycle completed — proposed next order ready for Torgima"
          : "Cycle incomplete — review intelligence.message",
      nextSteps: result.orderId
        ? ["Start order in Torgima dashboard", "POST /api/torgima/bhudhi/feedback when done"]
        : ["Set createOrder:true to persist a pending order", "Use proposedOrder for manual creation"],
      confidence: result.proposedOrder.confidence ?? undefined,
      reasoning: result.proposedOrder.reasoning ?? undefined,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

/** POST /api/torgima/bhudhi/feedback */
router.post("/torgima/bhudhi/feedback", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = feedbackBody.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId and orderId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await convergenceLayer.processFeedback(
      parsed.data.blueprintId,
      parsed.data.orderId,
      parsed.data.feedback ?? {},
    );

    bhudhiSuccess(res, {
      success: true,
      result,
      insight: "Feedback stored in shared context; Bhudhi cycle re-run for next order",
      nextSteps: ["GET /api/torgima/bhudhi/state", "Continue with proposedOrder from result.convergence"],
      confidence: result.bhudhi?.nextTaskRecommendation?.confidence,
      reasoning: result.bhudhi?.nextTaskRecommendation?.reasoning,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
