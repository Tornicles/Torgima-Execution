import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { experimentEngine } from "../bhudhi/experiments/experiment-engine/ExperimentEngine.js";

const router = Router();

const experimentBodySchema = z.object({
  blueprintId: z.string().uuid(),
  goal: z.string().min(1),
  belief: z.record(z.string(), z.unknown()).optional(),
  decision: z.record(z.string(), z.unknown()).optional(),
  worldState: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  hypothesisType: z
    .enum(["behavioral", "execution", "economic", "simulation", "identity", "strategy"])
    .optional(),
});

// POST /api/bhudhi/experiment/create
router.post("/bhudhi/experiment/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = experimentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid experiment payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const experiment = await experimentEngine.create(parsed.data);

    bhudhiSuccess(res, {
      success: true,
      experiment,
      insight: experiment.hypothesis.claim,
      nextSteps: ["POST /api/bhudhi/experiment/run", "POST /api/bhudhi/experiment/measure"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/experiment/run
router.post("/bhudhi/experiment/run", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ experimentId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "experimentId required", 422);
      return;
    }

    const run = await experimentEngine.run(parsed.data.experimentId);
    bhudhiSuccess(res, { success: true, run });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/experiment/measure
router.post("/bhudhi/experiment/measure", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        experimentId: z.string().uuid(),
        observations: z.record(z.string(), z.number()).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "experimentId required", 422);
      return;
    }

    const measured = await experimentEngine.measure(
      parsed.data.experimentId,
      parsed.data.observations,
    );
    bhudhiSuccess(res, { success: true, measured });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/experiment/compare
router.post("/bhudhi/experiment/compare", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ experimentId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "experimentId required", 422);
      return;
    }

    const result = await experimentEngine.compare(parsed.data.experimentId);
    bhudhiSuccess(res, { success: true, ...result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/experiment/promote
router.post("/bhudhi/experiment/promote", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        experimentId: z.string().uuid(),
        blueprintId: z.string().uuid(),
        governanceOk: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "experimentId and blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await experimentEngine.promote(
      parsed.data.experimentId,
      parsed.data.blueprintId,
      parsed.data.governanceOk ?? false,
    );

    bhudhiSuccess(res, { success: true, ...result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/experiment/history
router.post("/bhudhi/experiment/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), limit: z.number().int().min(1).max(50).optional() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const history = await experimentEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
