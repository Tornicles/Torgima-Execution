import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { economicsEngine } from "../bhudhi/economics/EconomicsEngine.js";
import { intelligenceExchange } from "../bhudhi/economics/model-selector/IntelligenceExchange.js";
import { confidenceExchange } from "../bhudhi/economics/confidence-allocation/ConfidenceExchange.js";
import { executionRoi } from "../bhudhi/economics/execution-cost/ExecutionROI.js";
import { memoryEconomics } from "../bhudhi/economics/memory-cost/MemoryEconomics.js";
import { simulationEconomics } from "../bhudhi/economics/simulation-economics/SimulationEconomics.js";
import { getOrCreateProfile } from "../bhudhi/economics/economicsData.js";

const router = Router();

// GET /api/bhudhi/economics/overview
router.get("/bhudhi/economics/overview", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().safeParse(req.query.blueprintId);

    const { metrics, proposals } = await economicsEngine.getObservatory(auth.userId);
    const profile = await getOrCreateProfile(auth.userId, blueprintId.success ? blueprintId.data : undefined);

    bhudhiSuccess(res, {
      success: true,
      profile: {
        dailyTokenBudget: profile.daily_token_budget,
        dailyUsdBudget: profile.daily_usd_budget,
        targetConfidence: profile.target_confidence,
        executionMode: profile.execution_mode,
      },
      metrics,
      optimizationProposals: proposals,
      insight: "Intelligence economics optimizes cost-per-quality, not raw power",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/economics/models
router.get("/bhudhi/economics/models", async (_req, res) => {
  try {
    const models = intelligenceExchange.rank(0.8);
    bhudhiSuccess(res, { success: true, models, count: models.length });
  } catch (err) {
    handleError(_req, res, err);
  }
});

// POST /api/bhudhi/economics/route — compute router preview
router.post("/bhudhi/economics/route", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        trigger: z.string(),
        blueprintId: z.string().uuid().optional(),
        confidence: z.number().optional(),
        simulation: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "trigger required", 422);
      return;
    }

    if (parsed.data.blueprintId) {
      const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
      if (!ok) return;
    }

    const plan = await economicsEngine.planIntelligencePath({
      userId: auth.userId,
      blueprintId: parsed.data.blueprintId,
      task: parsed.data.trigger,
      trigger: parsed.data.trigger,
      confidence: parsed.data.confidence,
      simulation: parsed.data.simulation,
    });

    bhudhiSuccess(res, {
      success: true,
      plan,
      cheapestSafePath: plan.compute.route,
      insight: plan.roi.reasoning,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/economics/roi
router.post("/bhudhi/economics/roi", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        trigger: z.string(),
        estimatedCostUsd: z.number(),
        confidence: z.number().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid ROI payload", 422);
      return;
    }

    const roi = executionRoi.evaluate(
      {
        userId: "preview",
        task: parsed.data.trigger,
        trigger: parsed.data.trigger,
        confidence: parsed.data.confidence,
      },
      parsed.data.estimatedCostUsd,
    );

    bhudhiSuccess(res, { success: true, roi });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/economics/confidence
router.get("/bhudhi/economics/confidence", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const target = z.coerce.number().min(0.5).max(0.99).safeParse(req.query.target ?? 0.8);
    const alloc = confidenceExchange.resolve(target.success ? target.data : 0.8);
    bhudhiSuccess(res, { success: true, allocation: alloc });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/economics/memory
router.get("/bhudhi/economics/memory", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const recall = z.coerce.number().optional().safeParse(req.query.recallCount);
    const age = z.coerce.number().optional().safeParse(req.query.ageDays);
    const type = z.string().optional().safeParse(req.query.memoryType);

    const result = memoryEconomics.classify(
      recall.success ? recall.data ?? 5 : 5,
      age.success ? age.data ?? 7 : 7,
      type.success ? type.data ?? "operational" : "operational",
    );

    bhudhiSuccess(res, { success: true, memory: result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/economics/simulation
router.post("/bhudhi/economics/simulation", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        simulationValue: z.number().default(1),
        budgetUsd: z.number().default(0.5),
        priority: z.enum(["low", "normal", "high", "critical"]).optional(),
      })
      .safeParse(req.body ?? {});

    const sim = simulationEconomics.plan(
      parsed.success ? parsed.data.simulationValue : 1,
      parsed.success ? parsed.data.budgetUsd : 0.5,
      parsed.success ? parsed.data.priority : "normal",
    );

    bhudhiSuccess(res, { success: true, simulation: sim });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/economics/forecast
router.get("/bhudhi/economics/forecast", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().safeParse(req.query.blueprintId);

    const points = await economicsEngine.runForecast(
      auth.userId,
      blueprintId.success ? blueprintId.data : undefined,
    );

    bhudhiSuccess(res, { success: true, forecasts: points });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/economics/initialize
router.post("/bhudhi/economics/initialize", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    await economicsEngine.initialize();
    bhudhiSuccess(res, { success: true, message: "Economics engine initialized" });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
