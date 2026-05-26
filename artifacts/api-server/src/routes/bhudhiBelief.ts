import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { beliefEngine } from "../bhudhi/beliefs/belief-engine/BeliefEngine.js";
import { evidenceEngine } from "../bhudhi/beliefs/evidence-engine/EvidenceEngine.js";

const router = Router();

// POST /api/bhudhi/belief/create
router.post("/bhudhi/belief/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        trigger: z.string().optional(),
        memory: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
        research: z.record(z.string(), z.unknown()).optional(),
        simulation: z.record(z.string(), z.unknown()).optional(),
        decision: z.record(z.string(), z.unknown()).optional(),
        feedback: z.record(z.string(), z.unknown()).optional(),
        signals: z.record(z.string(), z.unknown()).optional(),
        constraints: z.array(z.string()).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid belief payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const beliefs = await beliefEngine.process({
      blueprintId: parsed.data.blueprintId,
      userId: auth.userId,
      trigger: parsed.data.trigger,
      memory: parsed.data.memory,
      research: parsed.data.research,
      simulation: parsed.data.simulation,
      decision: parsed.data.decision,
      feedback: parsed.data.feedback,
      signals: parsed.data.signals,
      constraints: parsed.data.constraints,
    });

    bhudhiSuccess(res, {
      success: true,
      beliefs,
      insight: beliefs.uncertainty.recommendation,
      confidence: beliefs.confidence,
      nextSteps: beliefs.contradictions.length
        ? ["POST /api/bhudhi/belief/resolve", "POST /api/bhudhi/governance/check"]
        : ["POST /api/bhudhi/belief/validate"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/belief/evidence
router.post("/bhudhi/belief/evidence", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        source: z.enum(["memory", "research", "execution", "simulation", "feedback", "life"]),
        reliability: z.number().min(0).max(1).optional(),
        recency: z.number().min(0).max(1).optional(),
        agreement: z.number().min(0).max(1).optional(),
        repeatability: z.number().min(0).max(1).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid evidence payload", 422);
      return;
    }

    const scored = evidenceEngine.score(parsed.data.source, parsed.data);
    bhudhiSuccess(res, { success: true, evidence: scored });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/belief/validate
router.post("/bhudhi/belief/validate", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ beliefId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "beliefId required", 422);
      return;
    }

    const record = await beliefEngine.validate(parsed.data.beliefId);
    if (!record) {
      failure(res, "NOT_FOUND", "Belief not found", 404);
      return;
    }

    bhudhiSuccess(res, { success: true, belief: record, insight: "Evidence survived challenge" });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/belief/evolve
router.post("/bhudhi/belief/evolve", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ beliefId: z.string().uuid(), reason: z.string().min(1) })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "beliefId and reason required", 422);
      return;
    }

    const record = await beliefEngine.evolve(parsed.data.beliefId, parsed.data.reason);
    if (!record) {
      failure(res, "NOT_FOUND", "Belief not found", 404);
      return;
    }

    bhudhiSuccess(res, { success: true, belief: record });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/belief/resolve
router.post("/bhudhi/belief/resolve", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ conflictId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "conflictId required", 422);
      return;
    }

    const resolved = await beliefEngine.resolve(parsed.data.conflictId);
    if (!resolved) {
      failure(res, "NOT_FOUND", "Conflict not found", 404);
      return;
    }

    bhudhiSuccess(res, { success: true, resolved: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/belief/history
router.post("/bhudhi/belief/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), limit: z.number().int().min(1).max(100).optional() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const beliefs = await beliefEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, beliefs });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
