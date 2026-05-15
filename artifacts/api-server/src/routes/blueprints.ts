import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { getExecutionCommandCenter } from "../services/ExecutionCommandCenterService.js";
import { ValidationService } from "../services/ValidationService.js";
import { success, failure, handleError } from "../lib/utils.js";
import {
  checkCompletionEligibility,
  completeBlueprint,
  getCompletionSummary,
} from "../engines/lifecycle/CompletionEngine.js";
import {
  evaluatePivotEligibility,
  generatePivotPathOptions,
} from "../engines/strategy/StrategyEngine.js";
import { BLUEPRINT_SELECTION_CATALOG } from "../engines/blueprint/BlueprintRuleEngine.js";
import { BlueprintInfrastructureService } from "../services/BlueprintInfrastructureService.js";
import { getClientFeatureManifest } from "../engines/blueprint/infrastructure/BlueprintTypeRegistry.js";
import { parseMode, parseTier } from "../engines/blueprint/BlueprintRuleEngine.js";
import {
  createPivotReview,
  resolvePivotReview,
  dismissPivotReview,
} from "../engines/lifecycle/PivotEngine.js";
import {
  db,
  blueprints,
  pivotReviews,
  domainHistory,
  frameworkActivations,
  frameworkDecisions,
  behaviorPatterns,
  events,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

// GET /api/blueprints/features — client-side feature gating manifest
router.get("/blueprints/features", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const tier = parseTier(String(req.query.tier ?? "starter"));
    const mode = parseMode(String(req.query.mode ?? "individual"));
    success(res, getClientFeatureManifest(tier, mode));
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/selection-catalog — tier/mode comparison for mandatory selection UI
router.get("/blueprints/selection-catalog", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    success(res, BLUEPRINT_SELECTION_CATALOG);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints
router.get("/blueprints", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprints = await BlueprintService.list(auth.userId);
    success(res, blueprints);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints
router.post("/blueprints", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      goal:            z.string().min(1).max(2000).optional(),
      rawGoal:         z.string().min(1).max(2000).optional(),
      purpose:         z.string().max(500).optional().nullable(),
      timeframeDays:   z.number().int().min(7).max(730).optional().nullable(),
      domainHint:      z.string().optional().nullable(),
      domain:          z.string().optional().nullable(),
      commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid blueprint input", 422);
      return;
    }

    const body = parsed.data;
    const goal = body.goal ?? body.rawGoal;
    if (!goal) {
      failure(res, "VALIDATION_ERROR", "goal is required", 422);
      return;
    }

    const result = await BlueprintService.create(auth.userId, {
      goal,
      purpose:         body.purpose ?? null,
      timeframeDays:   body.timeframeDays ?? null,
      domainHint:      body.domainHint ?? body.domain ?? null,
      commitmentLevel: body.commitmentLevel ?? null,
    });

    success(res, result, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/history
router.get("/blueprints/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const history = await BlueprintService.getHistory(auth.userId);
    success(res, history);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id
router.get("/blueprints/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprint = await BlueprintService.get(req.params.id!, auth.userId);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/infrastructure — operational graph, failure state, gating manifest
router.get("/blueprints/:id/infrastructure", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const view = await BlueprintInfrastructureService.getInfrastructureView(
      req.params.id!,
      auth.userId,
    );
    if (!view) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    success(res, view);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/migrate-tier
router.post("/blueprints/:id/migrate-tier", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z.object({ targetTier: z.enum(["growth", "ultimate"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "targetTier required", 422);
      return;
    }
    const result = await BlueprintInfrastructureService.migrateTier(
      req.params.id!,
      auth.userId,
      parsed.data.targetTier,
    );
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/configure-selection — mandatory tier + mode before launch
router.post("/blueprints/:id/configure-selection", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z.object({
      tier: z.enum(["starter", "growth", "ultimate"]),
      mode: z.enum(["individual", "team"]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "tier and mode are required", 422);
      return;
    }
    const result = await BlueprintService.configureSelection(
      req.params.id!,
      auth.userId,
      parsed.data,
    );
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/activate — Prompt 5: accepts optional selectedPath
router.post("/blueprints/:id/activate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      selectedPath: z.enum(["current", "adjusted", "alternative"]).optional(),
    });

    const body = schema.safeParse(req.body).data ?? {};

    // If a path was selected, store it on the validation record first
    if (body.selectedPath) {
      await ValidationService.selectValidationPath({
        blueprintId:  req.params.id!,
        userId:       auth.userId,
        selectedPath: body.selectedPath,
      }).catch(() => null); // Non-fatal — blueprint may not have a validation record
    }

    const result = await BlueprintService.activate(req.params.id!, auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/state
router.get("/blueprints/:id/state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const state = await BlueprintService.getBlueprintState(req.params.id!, auth.userId);
    success(res, state);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/command-center — full hierarchy, locks, signals, policies
router.get("/blueprints/:id/command-center", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const payload = await getExecutionCommandCenter(req.params.id!, auth.userId);
    success(res, payload);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/execution-feed — operational event stream / loop timeline
router.get("/blueprints/:id/execution-feed", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, id), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const limitRaw = parseInt(String(req.query.limit ?? "80"), 10);
    const limit = Math.min(Number.isFinite(limitRaw) ? limitRaw : 80, 150);

    const feed = await db
      .select({
        id: events.id,
        eventType: events.event_type,
        entityType: events.entity_type,
        entityId: events.entity_id,
        payload: events.payload,
        status: events.status,
        createdAt: events.created_at,
      })
      .from(events)
      .where(eq(events.blueprint_id, id))
      .orderBy(desc(events.created_at))
      .limit(limit);

    success(res, { blueprintId: id, events: feed });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/domain-history — Prompt 14
router.get("/blueprints/:id/domain-history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, id), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const history = await db
      .select()
      .from(domainHistory)
      .where(eq(domainHistory.blueprint_id, id))
      .orderBy(desc(domainHistory.entered_at))
      .limit(20);

    success(res, {
      history: history.map((h) => ({
        domain: h.domain,
        previousDomain: h.previous_domain,
        transitionTrigger: h.transition_trigger,
        isCurrent: h.is_current,
        enteredAt: h.entered_at,
        exitedAt: h.exited_at,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/framework-activations — Prompt 14
router.get("/blueprints/:id/framework-activations", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, id), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const activations = await db
      .select()
      .from(frameworkActivations)
      .where(eq(frameworkActivations.blueprint_id, id))
      .orderBy(desc(frameworkActivations.created_at))
      .limit(20);

    const decisions = await db
      .select()
      .from(frameworkDecisions)
      .where(eq(frameworkDecisions.blueprint_id, id))
      .orderBy(desc(frameworkDecisions.created_at))
      .limit(10);

    success(res, { activations, decisions });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/behavior-patterns — Prompt 14 analytics
router.get("/blueprints/:id/behavior-patterns", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, id), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const patterns = await db
      .select()
      .from(behaviorPatterns)
      .where(and(eq(behaviorPatterns.user_id, auth.userId), eq(behaviorPatterns.blueprint_id, id)))
      .orderBy(desc(behaviorPatterns.last_detected_at))
      .limit(30);

    success(res, { patterns });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/pause
router.post("/blueprints/:id/pause", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({ reason: z.string().min(1).max(1000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "reason is required", 422);
      return;
    }

    const blueprint = await BlueprintService.pause(req.params.id!, auth.userId, parsed.data.reason);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/resume
router.post("/blueprints/:id/resume", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprint = await BlueprintService.resume(req.params.id!, auth.userId);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/completion-status
router.get("/blueprints/:id/completion-status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await checkCompletionEligibility({ blueprintId: req.params.id!, userId: auth.userId });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/completion-summary
router.get("/blueprints/:id/completion-summary", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const summary = await getCompletionSummary(req.params.id!, auth.userId);
    if (!summary) {
      failure(res, "NOT_FOUND", "Completion summary not available", 404);
      return;
    }
    success(res, summary);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/complete
router.post("/blueprints/:id/complete", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await completeBlueprint({ blueprintId: req.params.id!, userId: auth.userId });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/pause-status
router.get("/blueprints/:id/pause-status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [bp] = await db
      .select({
        id: blueprints.id,
        status: blueprints.status,
        paused_at: blueprints.paused_at,
        pause_reason: blueprints.pause_reason,
        goal: blueprints.goal,
      })
      .from(blueprints)
      .where(and(eq(blueprints.id, req.params.id!), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const pauseGapDays = bp.paused_at
      ? Math.floor((Date.now() - bp.paused_at.getTime()) / 86400000)
      : 0;

    const resumeMode =
      pauseGapDays <= 2 ? "normal" : pauseGapDays <= 7 ? "check_in" : pauseGapDays <= 30 ? "recovery" : "restart";

    success(res, {
      isPaused: bp.status === "paused",
      pausedAt: bp.paused_at,
      pauseReason: bp.pause_reason,
      pauseGapDays,
      resumeMode: bp.status === "paused" ? resumeMode : null,
      goal: bp.goal,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/pivot-review/current
router.get("/blueprints/:id/pivot-review/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [review] = await db
      .select()
      .from(pivotReviews)
      .where(
        and(
          eq(pivotReviews.blueprint_id, req.params.id!),
          eq(pivotReviews.user_id, auth.userId),
          eq(pivotReviews.status, "open"),
        ),
      )
      .limit(1);

    success(res, {
      pivotReviewOpen: !!review,
      pivotReview: review
        ? {
            id: review.id,
            triggerType: review.trigger_type,
            triggerReason: review.trigger_reason,
            conditionAtTrigger: review.condition_at_trigger,
            pathOptions: review.path_options_json,
            status: review.status,
            createdAt: review.created_at,
          }
        : null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/pivot-review/:reviewId/resolve
router.post("/blueprints/:id/pivot-review/:reviewId/resolve", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z.object({
      selectedPath: z.enum(["continue", "adjust", "pivot"]),
      confirmed: z.boolean(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 400);
      return;
    }
    if (!parsed.data.confirmed) {
      failure(res, "VALIDATION_ERROR", "Confirmation required", 400);
      return;
    }

    await resolvePivotReview({
      reviewId: req.params.reviewId!,
      blueprintId: req.params.id!,
      userId: auth.userId,
      selectedPath: parsed.data.selectedPath,
    });

    success(res, { resolved: true, selectedPath: parsed.data.selectedPath });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/pivot-review/:reviewId/dismiss
router.post("/blueprints/:id/pivot-review/:reviewId/dismiss", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    await dismissPivotReview({
      reviewId: req.params.reviewId!,
      blueprintId: req.params.id!,
      userId: auth.userId,
    });
    success(res, { dismissed: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/strategy-review/request
router.post("/blueprints/:id/strategy-review/request", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const eligibility = await evaluatePivotEligibility({
      blueprintId: req.params.id!,
      userId: auth.userId,
      triggerType: "manual",
    });

    if (!eligibility.eligible) {
      failure(res, "FEATURE_DISABLED", eligibility.blockedReason ?? "Review not available", 400);
      return;
    }

    const reviewId = await createPivotReview({
      blueprintId: req.params.id!,
      userId: auth.userId,
      triggerType: "manual",
      triggerReason: "User requested strategy review",
    });

    generatePivotPathOptions({
      blueprintId: req.params.id!,
      userId: auth.userId,
      pivotReviewId: reviewId,
    }).catch(() => null);

    success(res, { reviewId, created: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
