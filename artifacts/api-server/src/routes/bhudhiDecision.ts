import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { decisionEngine } from "../bhudhi/decision/decision-engine/DecisionEngine.js";

const router = Router();

// POST /api/bhudhi/decision/create
router.post("/bhudhi/decision/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        trigger: z.string(),
        goal: z.string().min(1),
        recommendationId: z.string().uuid().optional(),
        context: z.record(z.string(), z.unknown()).optional(),
        signals: z
          .object({ global: z.string().optional(), confidence: z.number().optional() })
          .optional(),
        constraints: z.array(z.string()).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid decision payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const decision = await decisionEngine.create({
      trigger: parsed.data.trigger,
      goal: parsed.data.goal,
      blueprintId: parsed.data.blueprintId,
      recommendationId: parsed.data.recommendationId,
      context: parsed.data.context,
      signals: parsed.data.signals,
      constraints: parsed.data.constraints,
    });

    bhudhiSuccess(res, {
      success: true,
      decision,
      insight: decision.explanation,
      confidence: decision.confidence,
      nextSteps: decision.approval.ready
        ? ["POST /api/bhudhi/decision/approve", "POST /api/bhudhi/execute"]
        : ["Escalate via POST /api/bhudhi/governance/check"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/decision/evaluate
router.post("/bhudhi/decision/evaluate", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ decisionId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "decisionId required", 422);
      return;
    }

    const decision = await decisionEngine.evaluate(parsed.data.decisionId);
    if (!decision) {
      failure(res, "NOT_FOUND", "Decision not found", 404);
      return;
    }

    bhudhiSuccess(res, { success: true, decision });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/decision/forecast
router.post("/bhudhi/decision/forecast", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ decisionId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "decisionId required", 422);
      return;
    }

    const forecasts = await decisionEngine.forecast(parsed.data.decisionId);
    bhudhiSuccess(res, {
      success: true,
      forecasts,
      scenarioTree: forecasts.flatMap((f) => f.scenarioTree ?? []),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/decision/replay
router.post("/bhudhi/decision/replay", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        decisionId: z.string().uuid(),
        branchOptionId: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "decisionId required", 422);
      return;
    }

    const replay = await decisionEngine.replay(
      parsed.data.decisionId,
      parsed.data.branchOptionId,
    );
    if (!replay) {
      failure(res, "NOT_FOUND", "Decision not found", 404);
      return;
    }

    bhudhiSuccess(res, { success: true, replay });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/decision/approve
router.post("/bhudhi/decision/approve", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        decisionId: z.string().uuid(),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "decisionId required", 422);
      return;
    }

    if (parsed.data.blueprintId) {
      const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
      if (!ok) return;
    }

    const approved = await decisionEngine.approve(parsed.data.decisionId);
    bhudhiSuccess(res, {
      success: approved,
      insight: approved ? "Decision approved — execution may proceed" : "Approval failed",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/decision/history
router.post("/bhudhi/decision/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const history = await decisionEngine.history(
      parsed.data.blueprintId,
      parsed.data.limit ?? 20,
    );

    bhudhiSuccess(res, {
      success: true,
      count: history.length,
      decisions: history.map((h) => ({
        decisionId: h.id,
        goal: h.goal,
        selected: h.selected_option_id,
        confidence: h.confidence,
        status: h.status,
        approvalStatus: h.approval_status,
        createdAt: h.created_at,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
