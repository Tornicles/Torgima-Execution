import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { civilizationEngine } from "../bhudhi/civilization/civilization-engine/CivilizationEngine.js";
import { listCivilizations } from "../bhudhi/civilization/civilizationData.js";

const router = Router();

const civilizationBodySchema = z.object({
  blueprintId: z.string().uuid(),
  civilizationId: z.string().uuid().optional(),
  horizonYears: z.number().int().min(1).max(100).optional(),
  name: z.string().optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  economy: z.record(z.string(), z.unknown()).optional(),
  teams: z.array(z.record(z.string(), z.unknown())).optional(),
  organizations: z.array(z.record(z.string(), z.unknown())).optional(),
  time: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  seed: z.string().optional(),
  simulation: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/bhudhi/civilizations?blueprintId= — list civilizations for blueprint
router.get("/bhudhi/civilizations", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().safeParse(req.query.blueprintId);
    if (!blueprintId.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId query required", 400);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId.data, auth.userId);
    if (!ok) return;

    const civilizations = await listCivilizations(blueprintId.data);
    bhudhiSuccess(res, { success: true, civilizations });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/create
router.post("/bhudhi/civilization/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = civilizationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid civilization payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const civilization = await civilizationEngine.create(parsed.data);
    bhudhiSuccess(res, {
      success: true,
      civilization,
      insight: civilization.recommendation,
      nextSteps: [
        "POST /api/bhudhi/civilization/simulate",
        "POST /api/bhudhi/civilization/forecast",
        "POST /api/bhudhi/civilization/resilience",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/simulate
router.post("/bhudhi/civilization/simulate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = civilizationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid simulate payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const civilization = await civilizationEngine.simulate(parsed.data);
    bhudhiSuccess(res, { success: true, civilization });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/evolve
router.post("/bhudhi/civilization/evolve", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = civilizationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid evolve payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const civilization = await civilizationEngine.evolve(parsed.data);
    bhudhiSuccess(res, { success: true, civilization });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/forecast
router.post("/bhudhi/civilization/forecast", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = civilizationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid forecast payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const forecast = await civilizationEngine.forecast(parsed.data);
    bhudhiSuccess(res, { success: true, forecast });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/resilience
router.post("/bhudhi/civilization/resilience", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = civilizationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid resilience payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const resilience = await civilizationEngine.resilience(parsed.data);
    bhudhiSuccess(res, { success: true, resilience });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/simulate-years — multi-year trajectory (1–100)
router.post("/bhudhi/civilization/simulate-years", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = civilizationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid simulate-years payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const years = parsed.data.horizonYears ?? 10;
    const series = await civilizationEngine.simulateYears(parsed.data, years);
    const inflectionPoints = await civilizationEngine.inflectionPoints(parsed.data, years);

    bhudhiSuccess(res, {
      success: true,
      years,
      series,
      inflectionPoints,
      insight: `Simulated ${years} years — ${inflectionPoints.length} inflection point(s) detected`,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/inflection-points
router.post("/bhudhi/civilization/inflection-points", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = civilizationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid inflection payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const years = parsed.data.horizonYears ?? 25;
    const inflectionPoints = await civilizationEngine.inflectionPoints(parsed.data, years);
    bhudhiSuccess(res, { success: true, years, inflectionPoints });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/civilization/history
router.post("/bhudhi/civilization/history", async (req, res) => {
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

    const history = await civilizationEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
