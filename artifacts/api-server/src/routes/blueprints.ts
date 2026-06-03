import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { getExecutionCommandCenter } from "../services/ExecutionCommandCenterService.js";
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
import {
  BLUEPRINT_CREATION_FLOW,
  BLUEPRINT_TIER_CARDS,
} from "../engines/blueprint/blueprintTierManifest.js";
import { BlueprintInfrastructureService } from "../services/BlueprintInfrastructureService.js";
import { getClientFeatureManifest } from "../engines/blueprint/infrastructure/BlueprintTypeRegistry.js";
import { parseMode, parseTier } from "../engines/blueprint/BlueprintRuleEngine.js";
import { validateProjectNameStrict } from "../lib/projectName.js";
import { validateUUID } from "../lib/security/validateUuid.js";
import { BlueprintStatus } from "../types/stateMachine.js";
import {
  createPivotReview,
  resolvePivotReview,
  dismissPivotReview,
} from "../engines/lifecycle/PivotEngine.js";
import { BlueprintRouteService } from "../services/BlueprintRouteService.js";
import { db, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { BlueprintLaunchService } from "../services/BlueprintLaunchService.js";
import { ValidationLaunchService } from "../services/ValidationLaunchService.js";
import { ensureTierPreviewsPresent } from "../lib/ensureTierPreviews.js";

const router = Router();

const pathTypeSchema = z.enum(["current", "adjusted", "alternative"]);

const nullishUuid = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.string().uuid().optional(),
);

const nullishPathType = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  pathTypeSchema.optional(),
);

export const blueprintLaunchBodySchema = z
  .object({
    selectedPath: nullishPathType,
    selected_path_type: nullishPathType,
    selectedPathType: nullishPathType,
    selected_path: nullishPathType,
    selectedBlueprintLevel: z.enum(["starter", "growth", "ultimate"]).optional(),
    blueprint_level: z.enum(["starter", "growth", "ultimate"]).optional(),
    tier: z.enum(["starter", "growth", "ultimate"]).optional(),
    validationContractId: nullishUuid,
    validation_contract_id: nullishUuid,
    validationId: nullishUuid,
    validation_id: nullishUuid,
    domain: z.string().optional().default("general"),
    timeframe: z.string().optional().default("1yr"),
    commitment_level: z.string().optional().default("HIGH"),
    purpose: z.string().optional().default(""),
    confirmed: z.literal(true).optional(),
  })
  .transform((data) => ({
    selectedPath:
      data.selectedPath ?? data.selected_path_type ?? data.selectedPathType ?? data.selected_path ?? "current",
    selectedBlueprintLevel: data.selectedBlueprintLevel ?? data.blueprint_level ?? data.tier ?? "starter",
    validationContractId: data.validationContractId ?? data.validation_contract_id,
    validationId: data.validationId ?? data.validation_id,
    domain: data.domain,
    timeframe: data.timeframe,
    commitmentLevel: data.commitment_level,
    purpose: data.purpose,
  }));

const selectTierBodySchema = z
  .object({
    blueprintId: z.string().uuid(),
    validationId: z.string().uuid(),
    selectedTier: z.enum(["starter", "growth", "ultimate"]).optional(),
    selected_tier: z.enum(["starter", "growth", "ultimate"]).optional(),
    selectedPath: pathTypeSchema.optional(),
    selected_path: pathTypeSchema.optional(),
  })
  .transform((data) => ({
    blueprintId: data.blueprintId,
    validationId: data.validationId,
    selectedTier: data.selectedTier ?? data.selected_tier ?? "starter",
    selectedPath: data.selectedPath ?? data.selected_path ?? "adjusted",
  }));

async function selectTierLaunchHandler(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = selectTierBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      failure(res, "VALIDATION_ERROR", detail || "Invalid select-tier body", 400);
      return;
    }

    const { blueprintId, validationId, selectedTier, selectedPath } = parsed.data;
    const result = await ValidationLaunchService.launch({
      validationId,
      userId: auth.userId,
      blueprintId,
      tier: selectedTier,
      selectedPath,
    });

    success(res, {
      blueprintId: result.blueprintId,
      tier: result.tier ?? selectedTier,
      redirectTo: result.redirectTo,
      generationSummary: result.generationSummary,
      launched: result.launched,
    });
  } catch (err) {
    handleError(req, res, err);
  }
}

// POST /api/blueprints/select-tier — register before /blueprints/:id
router.post("/blueprints/select-tier", selectTierLaunchHandler);

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
    success(res, {
      ...BLUEPRINT_SELECTION_CATALOG,
      tierCards: BLUEPRINT_TIER_CARDS,
      creationFlow: BLUEPRINT_CREATION_FLOW,
    });
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
      goal: z.string().min(1).max(2000).optional(),
      rawGoal: z.string().min(1).max(2000).optional(),
      purpose: z.string().max(500).optional().default(""),
      timeframeDays: z.number().int().min(7).max(730).optional().nullable(),
      timeframe: z.string().optional().default("1yr"),
      domainHint: z.string().optional().nullable(),
      domain: z.string().optional().default("general"),
      commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional().default("medium"),
      tier: z.enum(["starter", "growth", "ultimate"]).optional().default("starter"),
      selected_path: pathTypeSchema.optional().default("current"),
      validation_id: nullishUuid,
      validationId: nullishUuid,
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

// PATCH /api/blueprints/:id/project-name — user-facing display name
router.patch("/blueprints/:id/project-name", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.id ?? "").trim();
    if (!blueprintId) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const raw = body.projectName ?? body.project_name;
    const errMsg = validateProjectNameStrict(raw);
    if (errMsg) {
      failure(res, "VALIDATION_ERROR", errMsg, 400);
      return;
    }
    const name = String(raw).trim();
    const updated = await BlueprintRouteService.updateProjectName(
      blueprintId,
      auth.userId,
      name,
    );
    success(res, updated);
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

// PATCH /api/blueprints/:id/select-path — persist path choice before launch
router.patch("/blueprints/:id/select-path", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.id ?? "").trim();
    if (!validateUUID(blueprintId)) {
      failure(res, "VALIDATION_ERROR", "Invalid blueprint id", 400);
      return;
    }
    const schema = z.object({ selectedPath: pathTypeSchema });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "selectedPath is required (current, adjusted, or alternative)", 422);
      return;
    }
    const result = await BlueprintRouteService.selectPath(
      blueprintId,
      auth.userId,
      parsed.data.selectedPath,
    );
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const blueprintLaunchHandler = async (req: import("express").Request, res: import("express").Response) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const parsed = blueprintLaunchBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      failure(res, "VALIDATION_ERROR", detail || "Invalid launch request", 422);
      return;
    }

    const blueprintId = String(req.params.id ?? "");
    const body = parsed.data;

    const resolved = await BlueprintRouteService.resolveLaunchValidationContract(
      blueprintId,
      auth.userId,
      {
      validationContractId: body.validationContractId,
      validationId: body.validationId,
    });

    if (!resolved?.contractId) {
      failure(
        res,
        "VALIDATION_ERROR",
        "validation_required: complete validation before launching this blueprint",
        400,
      );
      return;
    }

    const selectedPathType = pathTypeSchema.safeParse(
      body.selectedPath ?? resolved.selectedPath ?? "current",
    );
    if (!selectedPathType.success) {
      failure(res, "VALIDATION_ERROR", "Invalid selected path", 422);
      return;
    }

    const result = await BlueprintLaunchService.launch({
      blueprintId,
      userId: auth.userId,
      validationContractId: resolved.contractId,
      selectedPathType: selectedPathType.data,
      selectedBlueprintLevel: body.selectedBlueprintLevel,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
};

// POST /api/v1/blueprints/:id/launch — Prompt 4 alias for blueprint activate.
router.post("/v1/blueprints/:id/launch", blueprintLaunchHandler);

// POST /api/blueprints/:id/activate — canonical blueprint launch route.
router.post("/blueprints/:id/activate", blueprintLaunchHandler);

// GET /api/blueprints/:id/phase-readiness
router.get("/blueprints/:id/phase-readiness", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.id!;
    const readiness = await BlueprintRouteService.getPhaseReadiness(blueprintId, auth.userId);
    success(res, readiness);
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

    const limitRaw = parseInt(String(req.query.limit ?? "80"), 10);
    const limit = Math.min(Number.isFinite(limitRaw) ? limitRaw : 80, 150);

    const feed = await BlueprintRouteService.getExecutionFeed(id, auth.userId, limit);
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

    const history = await BlueprintRouteService.getDomainHistory(id, auth.userId);

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

    const { activations, decisions } = await BlueprintRouteService.getFrameworkActivations(
      id,
      auth.userId,
    );
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

    const patterns = await BlueprintRouteService.getBehaviorPatterns(id, auth.userId);
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
    const { bp, pauseGapDays, resumeMode } = await BlueprintRouteService.getPauseStatus(
      req.params.id!,
      auth.userId,
    );

    success(res, {
      isPaused: bp.status === BlueprintStatus.PAUSED,
      pausedAt: bp.paused_at,
      pauseReason: bp.pause_reason,
      pauseGapDays,
      resumeMode: bp.status === BlueprintStatus.PAUSED ? resumeMode : null,
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
    const review = await BlueprintRouteService.getCurrentPivotReview(
      req.params.id!,
      auth.userId,
    );

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

// GET /api/blueprints/:id/tier-preview — saved tier cards for selection screen
router.get("/blueprints/:id/tier-preview", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.id ?? "";
    if (!validateUUID(blueprintId)) {
      failure(res, "VALIDATION_ERROR", "Invalid blueprint id", 400);
      return;
    }
    await BlueprintService.get(blueprintId, auth.userId);

    const [validation] = await db
      .select({ id: validations.id, contract_id: validations.contract_id })
      .from(validations)
      .where(
        and(eq(validations.blueprint_id, blueprintId), eq(validations.user_id, auth.userId)),
      )
      .limit(1);

    if (!validation) {
      failure(res, "NOT_FOUND", "Validation not found for blueprint", 404);
      return;
    }

    const { TierPreviewEngine } = await import("../engines/blueprint/TierPreviewEngine.js");
    let previews = await TierPreviewEngine.listPreviews(validation.id, auth.userId);
    if (previews.length === 0) {
      previews = await ensureTierPreviewsPresent(validation.id, auth.userId);
    }
    success(res, { previews });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
