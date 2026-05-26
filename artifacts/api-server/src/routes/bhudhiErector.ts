import { Router } from "express";
import { z } from "zod/v4";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { requireAuth } from "../lib/auth.js";
import { erectorRuntime } from "../bhudhi/erector/runtime/ErectorRuntime.js";

const router = Router();

const erectorBodySchema = z.object({
  blueprintId: z.string().uuid(),
  goal: z.string().optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  blueprint: z.record(z.string(), z.unknown()).optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  identity: z.record(z.string(), z.unknown()).optional(),
  time: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  seed: z.string().optional(),
  mode: z.enum(["FAST", "STANDARD", "STRATEGIC", "REALITY"]).optional(),
  scenario: z.enum(["baseline", "optimistic", "realistic", "stress", "collapse"]).optional(),
});

// POST /api/bhudhi/erector/create
router.post("/bhudhi/erector/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = erectorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid erector payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const simulation = await erectorRuntime.create(parsed.data);
    bhudhiSuccess(res, {
      success: true,
      simulation,
      insight: simulation.recommendation,
      nextSteps: [
        "POST /api/bhudhi/erector/run",
        "POST /api/bhudhi/erector/score",
        "POST /api/bhudhi/erector/compare",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/erector/run
router.post("/bhudhi/erector/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = erectorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid run payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const simulation = await erectorRuntime.run(parsed.data);
    bhudhiSuccess(res, { success: true, simulation });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/erector/score
router.post("/bhudhi/erector/score", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        simulationId: z.string().uuid(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "simulationId and blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const score = await erectorRuntime.score(parsed.data.simulationId);
    bhudhiSuccess(res, { success: true, score });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/erector/compare
router.post("/bhudhi/erector/compare", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        simulationIds: z.array(z.string().uuid()).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const comparison = await erectorRuntime.compare(parsed.data.blueprintId, parsed.data.simulationIds);
    bhudhiSuccess(res, { success: true, comparison });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/erector/replay
router.post("/bhudhi/erector/replay", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = erectorBodySchema
      .extend({ simulationId: z.string().uuid() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid replay payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const { simulationId, ...input } = parsed.data;
    const simulation = await erectorRuntime.replay(simulationId, input);
    if (!simulation) {
      failure(res, "NOT_FOUND", "Simulation not found for replay", 404);
      return;
    }
    bhudhiSuccess(res, { success: true, simulation });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/erector/history
router.post("/bhudhi/erector/history", async (req, res) => {
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

    const history = await erectorRuntime.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
