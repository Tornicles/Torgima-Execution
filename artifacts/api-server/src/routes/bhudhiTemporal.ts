import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { temporalEngine } from "../bhudhi/temporal/temporal-engine/TemporalEngine.js";

const router = Router();

const temporalBodySchema = z.object({
  blueprintId: z.string().uuid(),
  goal: z.string().optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  identity: z.record(z.string(), z.unknown()).optional(),
  life: z.record(z.string(), z.unknown()).optional(),
  execution: z.record(z.string(), z.unknown()).optional(),
  signals: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  tasks: z
    .array(z.object({ id: z.string(), title: z.string(), dueAt: z.string().optional() }))
    .optional(),
  deadlines: z.array(z.object({ label: z.string(), at: z.string() })).optional(),
});

// POST /api/bhudhi/temporal/analyze
router.post("/bhudhi/temporal/analyze", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = temporalBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid temporal payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const temporal = await temporalEngine.analyze(parsed.data);

    bhudhiSuccess(res, {
      success: true,
      temporal,
      insight: temporal.recommendation,
      urgency: temporal.urgency,
      nextSteps: [
        "POST /api/bhudhi/temporal/window",
        "POST /api/bhudhi/temporal/forecast",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/temporal/window
router.post("/bhudhi/temporal/window", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = temporalBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid window payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const window = await temporalEngine.window(parsed.data);
    bhudhiSuccess(res, { success: true, window });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/temporal/forecast
router.post("/bhudhi/temporal/forecast", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = temporalBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid forecast payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const forecast = await temporalEngine.forecast(parsed.data);
    bhudhiSuccess(res, { success: true, forecast });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/temporal/branch
router.post("/bhudhi/temporal/branch", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = temporalBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid branch payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const branch = await temporalEngine.branch(parsed.data);
    bhudhiSuccess(res, { success: true, branch });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/temporal/schedule
router.post("/bhudhi/temporal/schedule", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = temporalBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid schedule payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const schedule = await temporalEngine.schedule(parsed.data);
    bhudhiSuccess(res, { success: true, schedule });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/temporal/history
router.post("/bhudhi/temporal/history", async (req, res) => {
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

    const history = await temporalEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
