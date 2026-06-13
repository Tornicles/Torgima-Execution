import { Router } from "express";
import { z } from "zod/v4";
import {
  db,
  blueprints,
  signalSnapshots,
  conditions,
  orders,
  bhudhiExternalConnections,
  bhudhiFrameworks,
  bhudhiDomains,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { ValidationService } from "../services/ValidationService.js";
import { explainState } from "../bhudhi/TriggerRouter.js";
import { success, failure, handleError } from "../lib/utils.js";
import { investigationService } from "../bhudhi/investigation/InvestigationService.js";
import { intelligenceService } from "../bhudhi/intelligence/IntelligenceService.js";
import { operatingService } from "../bhudhi/operating/OperatingService.js";
import { approveRecommendation } from "../bhudhi/operating/operatingData.js";
import { signalService } from "../bhudhi/signals/SignalService.js";
import { frameworksService } from "../bhudhi/frameworks/FrameworksService.js";
import { domainsService } from "../bhudhi/domains/DomainsService.js";
import { securityService } from "../bhudhi/security/SecurityService.js";
import { preservationService } from "../bhudhi/preservation/PreservationService.js";
import { externalService } from "../bhudhi/external/ExternalService.js";
import { bhudhiSuccess, BHUDHI_NEXT_STEPS } from "../bhudhi/api/bhudhiApiEnvelope.js";
import {
  BHUDHI_API_ROUTES,
  getBhudhiHealth,
  getBhudhiInsights,
  getBhudhiStatus,
} from "../bhudhi/api/BhudhiCatalogService.js";
import { blueprintIdFromQuery, requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { torgimaIntegration } from "../bhudhi/integration/TorgimaIntegration.js";
import { modulesService } from "../bhudhi/modules/ModulesService.js";
import { decisionEngine } from "../bhudhi/decision/decision-engine/DecisionEngine.js";
import { governanceEngine } from "../bhudhi/governance/GovernanceEngine.js";
import { approvalEngine } from "../bhudhi/governance/approval-engine/ApprovalEngine.js";
import { structureGoalDeterministic } from "../engines/validation/ValidationEngine.js";
import { logger } from "../lib/logger.js";

const router = Router();

// POST /api/bhudhi/structure-goal
router.post("/bhudhi/structure-goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      rawGoal:         z.string().min(3).max(500),
      purpose:         z.string().max(1000).optional(),
      timeframe:       z.string().max(200).optional(),
      commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional(),
      currentContext:  z.string().max(1000).optional(),
      successSignal:   z.string().max(500).optional(),
      knownBlockers:   z.string().max(500).optional(),
      domainHints:     z.array(z.string()).optional(),
      idempotencyKey:  z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }

    const input = parsed.data;
    const goalInput = {
      rawGoal: input.rawGoal,
      purpose: input.purpose,
      timeframe: input.timeframe,
      commitmentLevel: input.commitmentLevel,
      currentContext: input.currentContext,
      successSignal: input.successSignal,
      knownBlockers: input.knownBlockers,
      domainHints: input.domainHints,
      idempotencyKey: input.idempotencyKey ?? `bhudhi_${auth.userId}_${Date.now()}`,
    };

    let structured;
    try {
      structured = await ValidationService.structureGoal({
        userId: auth.userId,
        input: goalInput,
      });
    } catch (structureErr) {
      logger.error(
        {
          userId: auth.userId,
          err: structureErr instanceof Error ? structureErr.message : String(structureErr),
        },
        "[Bhudhi] structure-goal failed — deterministic fallback",
      );
      structured = structureGoalDeterministic(goalInput);
    }

    success(res, {
      structured,
      canProceed: structured.validationVerdict !== "INVALID",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

function operationalMathExcerptForBhudhi(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  const scores = doc["scores"];
  if (scores === null || typeof scores !== "object") return null;
  const slim: Record<string, { normalized?: number; formula?: string }> = {};
  for (const [k, v] of Object.entries(scores as Record<string, Record<string, unknown>>)) {
    if (v && typeof v === "object") {
      slim[k] = {
        normalized: typeof v["normalized"] === "number" ? v["normalized"] : undefined,
        formula: typeof v["formula"] === "string" ? v["formula"] : undefined,
      };
    }
  }
  const hints = doc["strategicMemoryHints"];
  return {
    schemaVersion: doc["schemaVersion"],
    adaptationExplanation:
      typeof doc["adaptationExplanation"] === "string"
        ? (doc["adaptationExplanation"] as string).slice(0, 420)
        : undefined,
    scores: slim,
    strategicMemoryHints: Array.isArray(hints) ? hints.slice(0, 12) : undefined,
  };
}

// POST /api/bhudhi/explain-state
router.post("/bhudhi/explain-state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const [blueprint] = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .orderBy(desc(blueprints.updated_at))
      .limit(1);

    if (!blueprint) {
      success(res, { explanation: null, fallbackUsed: false });
      return;
    }

    const [signal] = await db
      .select()
      .from(signalSnapshots)
      .where(and(eq(signalSnapshots.blueprint_id, blueprint.id), eq(signalSnapshots.is_current, true)))
      .limit(1);

    const [condition] = await db
      .select()
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, blueprint.id), eq(conditions.is_current, true)))
      .limit(1);

    const [currentOrder] = await db
      .select({ title: orders.title })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprint.id),
          eq(orders.user_id, auth.userId),
          inArray(orders.status, ["pending", "active"]),
        ),
      )
      .orderBy(desc(orders.priority))
      .limit(1);

    const result = await explainState({
      userId:            auth.userId,
      blueprintId:       blueprint.id,
      stateVersion:      blueprint.state_version,
      condition:         condition?.condition ?? blueprint.current_condition ?? "urgency",
      completionRate:    signal?.completion_rate ?? 0,
      weightedScore:     signal?.weighted_score ?? 0,
      momentum:          signal?.momentum ?? 0,
      trend:             signal?.trend ?? "stable",
      goal:              blueprint.goal,
      currentTaskTitle:  currentOrder?.title,
      conditionDuration: condition?.duration_days ?? 0,
      operationalMathematicsExcerpt:
        operationalMathExcerptForBhudhi(signal?.operational_mathematics_json ?? null),
    });

    success(res, {
      explanation:  result.output?.data ?? null,
      fallbackUsed: result.fallbackUsed,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/investigate — run all 13 investigation engines
router.post("/bhudhi/investigate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const investigations = await investigationService.investigateBlueprint(parsed.data.blueprintId);
    success(res, { success: true, investigations, count: investigations.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/investigate/:engineId — run one investigation engine
router.post("/bhudhi/investigate/:engineId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid() })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const investigation = await investigationService.runEngineById(
      parsed.data.blueprintId,
      req.params.engineId!,
    );
    success(res, { success: true, investigation });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/investigations/:blueprintId — list stored investigations
router.get("/bhudhi/investigations/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId!;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const investigations = await investigationService.listInvestigations(blueprintId);
    success(res, { investigations, count: investigations.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/investigation/:id — single investigation record
router.get("/bhudhi/investigation/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const investigation = await investigationService.getInvestigation(req.params.id!);
    if (!investigation) {
      failure(res, "NOT_FOUND", "Investigation not found", 404);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, investigation.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    success(res, { investigation });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/intelligence — analyze investigations and generate recommendations
router.post("/bhudhi/intelligence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const recommendations = await intelligenceService.analyzeAndRecommend(parsed.data.blueprintId);
    const sorted = [...recommendations].sort((a, b) => b.confidence - a.confidence);
    success(res, {
      success: true,
      recommendations,
      count: recommendations.length,
      topRecommendation: sorted[0] ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/recommendations/:blueprintId
router.get("/bhudhi/recommendations/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId!;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const recommendations = await intelligenceService.listRecommendations(blueprintId);
    success(res, { recommendations, count: recommendations.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/recommendation/:id
router.get("/bhudhi/recommendation/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const recommendation = await intelligenceService.getRecommendation(req.params.id!);
    if (!recommendation) {
      failure(res, "NOT_FOUND", "Recommendation not found", 404);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, recommendation.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    success(res, { recommendation });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/recommendations/:id/approve — approve before operating execution
router.post("/bhudhi/recommendations/:id/approve", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const recommendation = await intelligenceService.getRecommendation(req.params.id!);
    if (!recommendation) {
      failure(res, "NOT_FOUND", "Recommendation not found", 404);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, recommendation.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const approvalId = await approvalEngine.createApprovalRequest({
      blueprintId: recommendation.blueprintId,
      subjectType: "recommendation",
      subjectId: req.params.id!,
      action: "EXECUTE_WORKFLOW",
      level: "L2",
    });
    await governanceEngine.grantApproval(approvalId, { type: "user", id: auth.userId }, "L2");

    const approved = await approveRecommendation(req.params.id!);
    bhudhiSuccess(res, {
      success: true,
      recommendation: approved,
      governanceApprovalId: approvalId,
      insight: "User L2 governance approval recorded — Bhudhi may not self-approve",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/operating/execute — execute approved recommendation
router.post("/bhudhi/operating/execute", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ recommendationId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "recommendationId required", 422);
      return;
    }

    const recommendation = await intelligenceService.getRecommendation(parsed.data.recommendationId);
    if (!recommendation) {
      failure(res, "NOT_FOUND", "Recommendation not found", 404);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, recommendation.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const result = await operatingService.executeRecommendation(parsed.data.recommendationId);
    success(res, { success: result.success, result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/operating/status?id=<recommendationId>
router.get("/bhudhi/operating/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const recommendationId = req.query.id as string | undefined;
    if (!recommendationId) {
      failure(res, "VALIDATION_ERROR", "id query param required", 422);
      return;
    }

    const recommendation = await intelligenceService.getRecommendation(recommendationId);
    if (!recommendation) {
      failure(res, "NOT_FOUND", "Recommendation not found", 404);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, recommendation.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const status = await operatingService.getOperatingStatus(recommendationId);
    success(res, { success: true, recommendation: status, status: status?.status });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/signals/calculate — compute and store Bhudhi signals
router.post("/bhudhi/signals/calculate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const signals = await signalService.calculateSignals(parsed.data.blueprintId);
    success(res, {
      success: true,
      signals,
      globalSignal: signals.globalSignal,
      interpretation: signalService.getSignalInterpretation(signals.globalSignal),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/signals/latest?blueprintId=
router.get("/bhudhi/signals/latest", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query.blueprintId as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId query param required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const signal = await signalService.getLatestSignal(blueprintId);
    success(res, {
      success: true,
      signal,
      interpretation: signal
        ? signalService.getSignalInterpretation(signal.globalSignal)
        : null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/frameworks/initialize — upsert all 15 framework definitions
router.post("/bhudhi/frameworks/initialize", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const count = await frameworksService.initializeFrameworks();
    success(res, { success: true, message: `Initialized ${count} frameworks`, count });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/frameworks/evaluate — evaluate one framework
router.post("/bhudhi/frameworks/evaluate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        frameworkName: z.string().min(1),
        blueprintId: z.string().uuid().optional(),
        investigations: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "frameworkName required", 422);
      return;
    }

    if (parsed.data.blueprintId) {
      const [bp] = await db
        .select({ id: blueprints.id })
        .from(blueprints)
        .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
        .limit(1);
      if (!bp) {
        failure(res, "NOT_FOUND", "Blueprint not found", 404);
        return;
      }
    }

    let result;
    if (parsed.data.blueprintId) {
      result = await frameworksService.evaluateFrameworkForBlueprint(
        parsed.data.blueprintId,
        parsed.data.frameworkName,
      );
    } else if (parsed.data.investigations) {
      result = frameworksService.evaluateFramework(
        parsed.data.frameworkName,
        parsed.data.investigations as never,
      );
    } else {
      failure(res, "VALIDATION_ERROR", "blueprintId or investigations required", 422);
      return;
    }

    if (!result) {
      failure(res, "NOT_FOUND", "Unknown framework", 404);
      return;
    }

    success(res, { success: true, framework: parsed.data.frameworkName, result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/frameworks/evaluate-all — evaluate all frameworks for blueprint
router.post("/bhudhi/frameworks/evaluate-all", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const results = await frameworksService.evaluateAllForBlueprint(parsed.data.blueprintId);
    success(res, { success: true, count: Object.keys(results).length, results });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/frameworks/:frameworkId/accuracy — update framework accuracy from outcome
router.post("/bhudhi/frameworks/:frameworkId/accuracy", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        actualOutcome: z.number().min(0).max(1),
        predictedOutcome: z.number().min(0).max(1),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "actualOutcome and predictedOutcome required (0-1)", 422);
      return;
    }

    const updated = await frameworksService.updateFrameworkAccuracy(
      req.params.frameworkId!,
      parsed.data.actualOutcome,
      parsed.data.predictedOutcome,
    );

    if (!updated) {
      failure(res, "NOT_FOUND", "Framework not found", 404);
      return;
    }

    success(res, { success: true, framework: updated });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/domains/initialize — upsert all 7 domain definitions
router.post("/bhudhi/domains/initialize", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const count = await domainsService.initializeDomains();
    success(res, { success: true, message: `Initialized ${count} domains`, count });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/domains/current?blueprintId=
router.get("/bhudhi/domains/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query.blueprintId as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const currentDomain = await domainsService.getCurrentDomain(blueprintId);
    const frameworks = await domainsService.getFrameworksForDomain(currentDomain);
    const conditions = domainsService.getDomainConditions(currentDomain);
    const description = domainsService.getDomainDescription(currentDomain);

    success(res, {
      success: true,
      currentDomain,
      description,
      activeFrameworks: frameworks.map((f) => ({ name: f.name, role: f.role })),
      conditions,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/domains/transition — detect and apply domain transition
router.post("/bhudhi/domains/transition", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        currentDomain: z.enum([
          "genesis",
          "market",
          "delivery",
          "operations",
          "growth",
          "continuity",
          "people",
        ]),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId and currentDomain required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const transition = await domainsService.checkDomainTransition(
      parsed.data.blueprintId,
      parsed.data.currentDomain,
    );

    if (!transition.transition) {
      success(res, {
        success: true,
        transition: false,
        message: "No domain transition needed",
      });
      return;
    }

    const result = await domainsService.handleDomainTransition(
      parsed.data.blueprintId,
      parsed.data.currentDomain,
      transition.newDomain,
    );

    success(res, { success: true, transition: true, result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/security/validate — validate recommendation before execution
router.post("/bhudhi/security/validate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        recommendationId: z.string().uuid(),
        blueprintId: z.string().uuid(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "recommendationId and blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const result = await securityService.validateRecommendation(
      parsed.data.recommendationId,
      parsed.data.blueprintId,
    );

    success(res, {
      success: result.valid,
      valid: result.valid,
      violations: result.violations,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/security/threats?blueprintId=
router.get("/bhudhi/security/threats", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query.blueprintId as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const threats = await securityService.detectThreats(blueprintId);
    success(res, { success: true, threats, count: threats.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/preservation/track-outcome
router.post("/bhudhi/preservation/track-outcome", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        recommendationId: z.string().uuid(),
        actualOutcome: z.number(),
        expectedOutcome: z.number(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId, recommendationId, outcomes required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const result = await preservationService.trackOutcome(
      parsed.data.blueprintId,
      parsed.data.recommendationId,
      parsed.data.actualOutcome,
      parsed.data.expectedOutcome,
    );

    if (!result) {
      failure(res, "NOT_FOUND", "Recommendation not found", 404);
      return;
    }

    success(res, { success: true, result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/preservation/improve-frameworks
router.post("/bhudhi/preservation/improve-frameworks", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const improvements = await preservationService.improveFrameworks(parsed.data.blueprintId);
    success(res, {
      success: true,
      improvements,
      frameworksImproved: Object.keys(improvements).length,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/preservation/consolidate — extract and persist learnings
router.post("/bhudhi/preservation/consolidate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const result = await preservationService.consolidateKnowledge(parsed.data.blueprintId);
    success(res, { ...result, success: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/preservation/learnings?blueprintId=
router.get("/bhudhi/preservation/learnings", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query.blueprintId as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const learnings = await preservationService.extractLearnings(blueprintId);
    success(res, { success: true, learnings, count: learnings.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/external/connect
router.post("/bhudhi/external/connect", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        systemName: z.string().min(1),
        systemType: z.enum(["crm", "hrms", "data_platform", "communication", "custom"]),
        apiEndpoint: z.string().min(1),
        credentials: z.record(z.string(), z.unknown()),
        syncFrequency: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid connect payload", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const result = await externalService.connectSystem({
      blueprintId: parsed.data.blueprintId,
      systemName: parsed.data.systemName,
      systemType: parsed.data.systemType,
      apiEndpoint: parsed.data.apiEndpoint,
      credentials: parsed.data.credentials as never,
      syncFrequency: parsed.data.syncFrequency,
    });

    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/external/sync
router.post("/bhudhi/external/sync", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ connectionId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "connectionId required", 422);
      return;
    }

    const [link] = await db
      .select({ userId: blueprints.user_id })
      .from(bhudhiExternalConnections)
      .innerJoin(blueprints, eq(blueprints.id, bhudhiExternalConnections.blueprint_id))
      .where(eq(bhudhiExternalConnections.id, parsed.data.connectionId))
      .limit(1);

    if (!link || link.userId !== auth.userId) {
      failure(res, "NOT_FOUND", "Connection not found", 404);
      return;
    }

    const result = await externalService.syncData(parsed.data.connectionId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/external/connections?blueprintId=
router.get("/bhudhi/external/connections", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query.blueprintId as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const connections = await externalService.getConnections(blueprintId);
    success(res, { success: true, connections, count: connections.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/external/disconnect
router.post("/bhudhi/external/disconnect", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ connectionId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "connectionId required", 422);
      return;
    }

    const [link] = await db
      .select({ userId: blueprints.user_id })
      .from(bhudhiExternalConnections)
      .innerJoin(blueprints, eq(blueprints.id, bhudhiExternalConnections.blueprint_id))
      .where(eq(bhudhiExternalConnections.id, parsed.data.connectionId))
      .limit(1);

    if (!link || link.userId !== auth.userId) {
      failure(res, "NOT_FOUND", "Connection not found", 404);
      return;
    }

    const disconnected = await externalService.disconnectSystem(parsed.data.connectionId);
    success(res, { success: true, connection: disconnected });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/external/push — push changes to external system
router.post("/bhudhi/external/push", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        connectionId: z.string().uuid(),
        changes: z.record(z.string(), z.unknown()),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "connectionId and changes required", 422);
      return;
    }

    const [link] = await db
      .select({ userId: blueprints.user_id })
      .from(bhudhiExternalConnections)
      .innerJoin(blueprints, eq(blueprints.id, bhudhiExternalConnections.blueprint_id))
      .where(eq(bhudhiExternalConnections.id, parsed.data.connectionId))
      .limit(1);

    if (!link || link.userId !== auth.userId) {
      failure(res, "NOT_FOUND", "Connection not found", 404);
      return;
    }

    const result = await externalService.pushChanges(
      parsed.data.connectionId,
      parsed.data.changes,
    );
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// ─── BHUDHI PROMPT 10 — Unified API surface ───────────────────────────────────

// GET /api/bhudhi/health
router.get("/bhudhi/health", async (req, res) => {
  try {
    const health = await getBhudhiHealth();
    bhudhiSuccess(res, {
      ...health,
      insight: health.status === "healthy" ? "Bhudhi catalog is seeded and reachable" : "Run seed:bhudhi to populate catalog",
      nextSteps: ["GET /api/bhudhi/status for per-blueprint runtime state"],
      reasoning: "Health reflects presence of systems, engines, and frameworks in the database.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/routes — API manifest
router.get("/bhudhi/routes", async (_req, res) => {
  bhudhiSuccess(res, {
    success: true,
    routes: BHUDHI_API_ROUTES,
    count: BHUDHI_API_ROUTES.length,
    insight: "Canonical Bhudhi HTTP endpoints (Prompt 10)",
  });
});

// GET /api/bhudhi/status?blueprintId=
router.get("/bhudhi/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    if (blueprintId) {
      const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
      if (!ok) return;
    }
    const status = await getBhudhiStatus(blueprintId);
    bhudhiSuccess(res, {
      ...status,
      insight: "Aggregate status across all five Bhudhi systems",
      nextSteps: [...BHUDHI_NEXT_STEPS.status],
      reasoning: "Engine counts and framework accuracy reflect catalog seed; signals are blueprint-specific when blueprintId is provided.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/insights?blueprintId=
router.get("/bhudhi/insights", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const insights = await getBhudhiInsights(blueprintId);
    bhudhiSuccess(res, {
      ...insights,
      insight: "Synthesized from latest investigations and validated framework learnings",
      nextSteps: ["POST /api/bhudhi/recommend to act on insights"],
      confidence: insights.totalInsights > 0 ? 0.8 : 0.4,
      reasoning: "Insights are flattened from investigation findings; learnings from bhudhi_framework_learning.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/recommend — alias for intelligence pipeline
router.post("/bhudhi/recommend", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const recommendations = await intelligenceService.analyzeAndRecommend(parsed.data.blueprintId);
    const sorted = [...recommendations].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0] ?? null;

    bhudhiSuccess(res, {
      success: true,
      recommendations: sorted,
      count: sorted.length,
      topRecommendation: top,
      insight: "Recommendations ranked by confidence and impact potential",
      nextSteps: [...BHUDHI_NEXT_STEPS.recommend],
      confidence: top?.confidence,
      reasoning: top?.reasoning ?? "Run POST /api/bhudhi/investigate first if no recommendations are returned.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/signals?blueprintId=
router.get("/bhudhi/signals", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const signal = await signalService.getLatestSignal(blueprintId);
    const interpretation = signal
      ? signalService.getSignalInterpretation(signal.globalSignal)
      : "No signals yet";

    bhudhiSuccess(res, {
      success: true,
      signal: signal?.globalSignal ?? null,
      confidence: signal?.globalSignalConfidence ?? undefined,
      interpretation,
      frameworkSignals: signal?.frameworkSignals ?? {},
      metrics: signal?.metrics ?? {},
      insight: interpretation,
      nextSteps: [...BHUDHI_NEXT_STEPS.signals],
      reasoning: "Latest row from bhudhi_signals for this blueprint.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/signals — calculate and persist
router.post("/bhudhi/signals", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const signals = await signalService.calculateSignals(parsed.data.blueprintId);
    const interpretation = signalService.getSignalInterpretation(signals.globalSignal);

    bhudhiSuccess(res, {
      success: true,
      signals,
      globalSignal: signals.globalSignal,
      interpretation,
      insight: interpretation,
      nextSteps: [...BHUDHI_NEXT_STEPS.signals],
      confidence: signals.globalSignalConfidence,
      reasoning: "Signals computed from orders, feedback, events, and framework overlays.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/frameworks — list active frameworks
router.get("/bhudhi/frameworks", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const frameworks = await db
      .select()
      .from(bhudhiFrameworks)
      .where(eq(bhudhiFrameworks.status, "active"));

    bhudhiSuccess(res, {
      success: true,
      frameworks,
      count: frameworks.length,
      types: {
        team: frameworks.filter((f) => f.type === "team").length,
        individual: frameworks.filter((f) => f.type === "individual").length,
      },
      insight: `${frameworks.length} active frameworks available for evaluation`,
      nextSteps: ["POST /api/bhudhi/frameworks with frameworkName to evaluate"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/frameworks — evaluate one framework (Prompt 10)
router.post("/bhudhi/frameworks", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        frameworkName: z.string().min(1),
        blueprintId: z.string().uuid().optional(),
        investigations: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "frameworkName required", 422);
      return;
    }

    if (parsed.data.blueprintId) {
      const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
      if (!ok) return;
    }

    let result;
    if (parsed.data.blueprintId) {
      result = await frameworksService.evaluateFrameworkForBlueprint(
        parsed.data.blueprintId,
        parsed.data.frameworkName,
      );
    } else if (parsed.data.investigations) {
      result = frameworksService.evaluateFramework(
        parsed.data.frameworkName,
        parsed.data.investigations as never,
      );
    } else {
      failure(res, "VALIDATION_ERROR", "blueprintId or investigations required", 422);
      return;
    }

    if (!result) {
      failure(res, "NOT_FOUND", "Unknown framework", 404);
      return;
    }

    bhudhiSuccess(res, {
      success: true,
      framework: parsed.data.frameworkName,
      result,
      signal: result.signal,
      confidence: result.confidence,
      recommendation: result.recommendation,
      insight: result.recommendation,
      nextSteps: ["POST /api/bhudhi/frameworks/evaluate-all for full blueprint pass"],
      reasoning: "Framework evaluator applied investigation findings to produce signal and recommendation.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/domains — list all domains
router.get("/bhudhi/domains", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const catalog = domainsService.listDomains();
    const rows = await db.select().from(bhudhiDomains);

    bhudhiSuccess(res, {
      success: true,
      domains: rows.length > 0 ? rows : catalog,
      count: rows.length > 0 ? rows.length : catalog.length,
      insight: "Seven lifecycle domains govern active frameworks",
      nextSteps: ["GET /api/bhudhi/domains/current?blueprintId= for resolved domain"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/execute — security validate then operating execute
router.post("/bhudhi/execute", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        recommendationId: z.string().uuid(),
        blueprintId: z.string().uuid(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "recommendationId and blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const recommendation = await intelligenceService.getRecommendation(parsed.data.recommendationId);

    if (!recommendation || recommendation.status !== "approved") {
      failure(
        res,
        "VALIDATION_ERROR",
        "Recommendation must be approved via governance before execute",
        422,
      );
      return;
    }

    const decisionGate = await decisionEngine.requireDecisionForExecution({
      blueprintId: parsed.data.blueprintId,
      recommendationId: parsed.data.recommendationId,
      trigger: "EXECUTE_WORKFLOW",
      goal: recommendation.title,
      title: recommendation.title,
      description: recommendation.description,
      confidence: recommendation.confidence,
    });

    if (!decisionGate.allowed) {
      bhudhiSuccess(res, {
        success: false,
        decision: decisionGate.decision,
        insight: "Execution blocked — decision not formed or not approved",
        reasoning: decisionGate.reason,
        nextSteps: ["POST /api/bhudhi/decision/approve", "POST /api/bhudhi/governance/check"],
      });
      return;
    }

    const governance = await governanceEngine.check(
      { type: "user", id: auth.userId },
      "EXECUTE_WORKFLOW",
      {
        blueprintId: parsed.data.blueprintId,
        recommendationId: parsed.data.recommendationId,
        confidence: recommendation?.confidence,
      },
    );

    if (!governance.allowed) {
      bhudhiSuccess(res, {
        success: false,
        governance,
        insight: "Execution blocked by governance",
        nextSteps: [
          "POST /api/bhudhi/recommendations/:id/approve for L2 approval",
          "POST /api/bhudhi/governance/approve with approvalId",
        ],
        reasoning: governance.explanation.why,
      });
      return;
    }

    const validation = await securityService.validateRecommendation(
      parsed.data.recommendationId,
      parsed.data.blueprintId,
    );

    if (!validation.valid) {
      bhudhiSuccess(res, {
        success: false,
        valid: false,
        violations: validation.violations,
        insight: "Execution blocked by security system",
        nextSteps: ["Resolve violations then retry", "POST /api/bhudhi/recommendations/:id/approve if pending"],
        reasoning: validation.violations.join("; "),
      });
      return;
    }

    const result = await operatingService.executeRecommendation(parsed.data.recommendationId);

    bhudhiSuccess(res, {
      success: result.success,
      valid: true,
      result,
      insight: result.success ? "Recommendation executed through operating system" : "Execution did not complete",
      nextSteps: [...BHUDHI_NEXT_STEPS.execute],
      confidence: recommendation?.confidence,
      reasoning: recommendation?.reasoning,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/torgima/next-task — Bhudhi-powered next order recommendation
router.post("/bhudhi/torgima/next-task", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const payload = await torgimaIntegration.getNextTaskBhudhiPayload(parsed.data.blueprintId);
    bhudhiSuccess(res, {
      ...payload,
      insight: payload.nextTask ? "Top Bhudhi recommendation for next execution step" : "No recommendations yet — run investigate first",
      nextSteps: ["POST /api/bhudhi/execute to apply an approved recommendation"],
      confidence: payload.confidence ?? undefined,
      reasoning: payload.reasoning ?? undefined,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/torgima/validate-goal — Erector-aligned goal validation via Bhudhi
router.post("/bhudhi/torgima/validate-goal", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        goal: z.string().min(1),
        purpose: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "goal required", 422);
      return;
    }

    const result = await torgimaIntegration.validateGoalWithBhudhi(
      parsed.data.goal,
      parsed.data.purpose ?? "",
    );

    bhudhiSuccess(res, {
      success: true,
      ...result,
      insight: result.validated ? "Goal passes Bhudhi framework analysis" : "Goal needs more clarity",
      reasoning: result.insights.join("; ") || "Synthetic investigation applied",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/torgima/domain-transition
router.post("/bhudhi/torgima/domain-transition", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        currentDomain: z.enum([
          "genesis",
          "market",
          "delivery",
          "operations",
          "growth",
          "continuity",
          "people",
        ]),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId and currentDomain required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await torgimaIntegration.checkDomainTransition(
      parsed.data.blueprintId,
      parsed.data.currentDomain,
    );

    bhudhiSuccess(res, { success: true, ...result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/bhudhi/modules — catalog of 8 Torgima AI modules (Bhudhi 2.0)
router.get("/bhudhi/modules", async (_req, res) => {
  try {
    const modules = await modulesService.listModules();
    bhudhiSuccess(res, {
      success: true,
      count: modules.length,
      modules: modules.map((m) => ({
        id: m.id,
        name: m.name,
        system: m.system,
        description: m.description,
        status: m.status,
        accuracy: m.accuracy,
        lastRunAt: m.last_run_at,
      })),
      insight: "Bhudhi 2.0 integrates 8 Torgima AI modules across Investigation, Intelligence, and Operating.",
      nextSteps: ["POST /api/bhudhi/modules/complete-cycle with blueprintId"],
    });
  } catch (err) {
    handleError(_req, res, err);
  }
});

// POST /api/bhudhi/modules/complete-cycle — run full Bhudhi 2.0 cycle
router.post("/bhudhi/modules/complete-cycle", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId (uuid) required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const cycle = await modulesService.runCompleteCycle(parsed.data.blueprintId);

    bhudhiSuccess(res, {
      success: true,
      cycle,
      systems: {
        investigation: "Complete with CIS, EIS, BIS",
        intelligence: "Complete with IIS, SIS, PIS, KIS",
        operating: "Complete with RIEZ",
        security: cycle.security.validated ? "Validated" : "Review required",
        preservation: cycle.preservation.preserved ? "Learning captured" : "Preservation skipped",
      },
      insight: `Strategy: ${cycle.intelligence.strategy.selected}`,
      confidence: cycle.intelligence.strategy.confidence,
      nextSteps: [...BHUDHI_NEXT_STEPS.execute],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
