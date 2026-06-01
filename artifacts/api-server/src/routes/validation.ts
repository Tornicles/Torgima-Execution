import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { ValidationService } from "../services/ValidationService.js";
import { ValidationLaunchService } from "../services/ValidationLaunchService.js";
import { success, failure, handleError } from "../lib/utils.js";
import { isTorgimaError } from "../lib/errors.js";
import { logSchemaDbError } from "../lib/schemaDbDiagnostics.js";
import { runErectorValidation } from "../engines/erector/ErectorOrchestrationService.js";
import { ERECTOR_ARCHETYPE_SEEDS } from "../engines/erector/archetypeData.js";
import { writeEvent } from "../services/EventService.js";
import { EventTypes } from "../types/eventContracts.js";
import { emitErectorFirstWeekGenerated } from "../engines/erector/emitErectorEvents.js";
import { generateFirstWeek } from "../engines/erector/PathEngine.js";
import { resolveArchetype } from "../engines/erector/ArchetypeResolutionEngine.js";
import { SequenceTrackingService } from "../services/SequenceTrackingService.js";
import { ErectorRefinementService } from "../services/ErectorRefinementService.js";
import { runErectorTwentyStages } from "../engines/erector/ErectorStageRunner.js";
import { rowToErectorResult } from "../engines/erector/ErectorOrchestrationHelpers.js";
import {
  buildOnboardingValidationResultsPayload,
  validationProgressFromStatus,
} from "../lib/buildOnboardingValidationResults.js";
import { resolveValidationTimeframeFields } from "../lib/validationTimeframe.js";
import type { ValidationFeedInput } from "../types/erector-complete.js";
import type { ErectorValidationInput } from "../types/erector.js";
import { ValidationKind } from "@workspace/state-machine";
import { transitionBlueprintToPathSelection } from "../lib/transitionBlueprintToPathSelection.js";
import { selectBlueprintLaunchHandler } from "./onboarding.js";

const router = Router();

const pathTypeSchema = z.enum(["current", "adjusted", "alternative"]);
const tierSchema = z.enum(["starter", "growth", "ultimate"]);
const modeSchema = z.enum(["individual", "team"]);

export const validationLaunchBodySchema = z.object({
  validation_id: z.string().uuid().optional(),
  blueprintId: z.string().uuid().optional(),
  blueprint_id: z.string().uuid().optional(),
  blueprintTier: tierSchema.optional(),
  blueprint_tier: tierSchema.optional(),
  selected_blueprint_type: tierSchema.optional(),
  selected_direction: z
    .object({
      path: pathTypeSchema.optional(),
      selectedPath: pathTypeSchema.optional(),
      tier: tierSchema.optional(),
      blueprint_level: tierSchema.optional(),
      blueprint_type: tierSchema.optional(),
      mode: modeSchema.optional(),
    })
    .optional(),
  selectedPath: pathTypeSchema.optional(),
  selected_path: pathTypeSchema.optional(),
  tier: tierSchema.optional(),
  blueprint_level: tierSchema.optional(),
  blueprint_type: tierSchema.optional(),
  mode: modeSchema.optional(),
  projectName: z.string().min(3).max(50).optional(),
  project_name: z.string().min(3).max(50).optional(),
});

const validationLaunchHandler = async (req: import("express").Request, res: import("express").Response) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const validationId = String(req.params.id ?? "").trim();
    if (!validationId) {
      failure(res, "NOT_FOUND", "Validation id is required", 404);
      return;
    }

    const parsed = validationLaunchBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      failure(res, "VALIDATION_ERROR", detail || "Invalid launch body", 400);
      return;
    }

    const body = parsed.data;
    logger.info(
      {
        route: "POST /api/v1/validations/:id/launch",
        userId: auth.userId,
        validationId,
        selectedDirectionPresent: Boolean(body.selected_direction),
      },
      "Validation launch HTTP handler reached",
    );

    const result = await ValidationLaunchService.launch({
      validationId,
      userId: auth.userId,
      selectedDirection: body.selected_direction,
      selectedPath: body.selectedPath ?? body.selected_path,
      tier:
        body.blueprintTier ??
        body.blueprint_tier ??
        body.selected_blueprint_type ??
        body.tier ??
        body.blueprint_level ??
        body.blueprint_type ??
        body.selected_direction?.tier ??
        body.selected_direction?.blueprint_level ??
        body.selected_direction?.blueprint_type,
      mode: body.mode ?? body.selected_direction?.mode,
      projectName: body.projectName ?? body.project_name,
      blueprintId: body.blueprintId ?? body.blueprint_id,
    });

    success(res, result, result.idempotent ? 200 : 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Launch CRASH]", message, "\n", stack);
    if (message.startsWith("[LAUNCH]")) {
      failure(res, "VALIDATION_ERROR", message.replace(/^\[LAUNCH\]\s*/, ""), 400);
      return;
    }
    if (isTorgimaError(err)) {
      handleError(req, res, err);
      return;
    }
    failure(res, "LAUNCH_FAILED", message, 500);
  }
};

async function loadOwnedErectorValidation(validationId: string, userId: string) {
  const { db, validations } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
  if (!row || row.user_id !== userId) return null;
  return row;
}

function erectorInputFromRow(row: typeof import("@workspace/db").validations.$inferSelect, userId: string): ErectorValidationInput {
  return {
    userId,
    blueprintId: row.blueprint_id,
    idempotencyKey: row.idempotency_key ?? `erector:${row.id}`,
    rawGoal: row.raw_goal ?? row.desired_outcome ?? "Execution goal",
    goalFinal: row.goal_final ?? undefined,
    purpose: row.purpose_final ?? row.purpose ?? row.desired_outcome ?? "Execution purpose",
    purposeFinal: row.purpose_final ?? undefined,
    timeframe: "90d",
    commitmentLevel: row.commitment_level ?? "MEDIUM",
    desiredOutcome: row.desired_outcome ?? "Proof and traction",
    location: { country: row.location_country ?? "Unknown", city: row.location_city ?? undefined },
    businessType: (row.business_type as "online" | "offline" | "hybrid") ?? "online",
    businessModel: row.business_model ?? "Service",
    budgetAvailable: row.budget_available ?? 0,
    currency: row.currency ?? "USD",
    currentResources: (row.current_resources as string[]) ?? ["Skills"],
    targetCustomer: row.target_customer ?? "Target segment",
    currentContext: row.current_context ?? undefined,
    successSignal: row.success_signal ?? undefined,
  };
}

async function persistFirstWeekPlan(
  row: typeof import("@workspace/db").validations.$inferSelect,
  userId: string,
  selectedPath: "current" | "adjusted" | "alternative",
) {
  const archetypeResolution = row.archetype_resolution as import("../types/erector.js").ArchetypeResolutionOutput | null;
  const archetype =
    archetypeResolution ??
    (await resolveArchetype(row.location_country ?? "Unknown", row.location_city ?? undefined));
  const firstWeekPlan = await generateFirstWeek(erectorInputFromRow(row, userId), archetype, row.id, selectedPath);
  const { db, validations } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const stored = {
    days: firstWeekPlan.days,
    plans: firstWeekPlan.plans,
  };
  await db.update(validations).set({ first_week_plan: stored }).where(eq(validations.id, row.id));
  const dayCount = Array.isArray(stored.days) ? stored.days.length : 7;
  await emitErectorFirstWeekGenerated({
    validationId: row.id,
    blueprintId: row.blueprint_id,
    userId,
    taskCount: dayCount,
    smokeTestCount: dayCount,
  });
  return stored;
}

export const erectorValidationInputSchema = z
  .object({
    blueprintId: z.string().uuid().optional(),
    idempotencyKey: z.string().min(8).max(200).optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
    rawGoal: z.string().min(5).max(500),
    purpose: z.string().min(3).max(1000),
    timeframe: z.string().min(1).max(80),
    customTimeframeDays: z.number().int().positive().optional(),
    commitmentLevel: z.string().min(2).max(20),
    desiredOutcome: z.string().max(500).optional().default(""),
    location: z
      .object({
        country: z.string().min(2).max(120),
        city: z.string().max(120).optional(),
      })
      .optional(),
    locationCountry: z.string().min(2).max(120).optional(),
    businessType: z.enum(["online", "offline", "hybrid"]).optional().default("online"),
    businessModel: z.string().min(2).max(120),
    budgetAvailable: z.number().min(0).optional().default(0),
    currency: z.string().min(2).max(12).optional().default("USD"),
    currentResources: z.array(z.string().min(1).max(80)).optional().default([]),
    targetCustomer: z.string().max(500).optional().default(""),
    knownBlockers: z.array(z.string().min(1).max(200)).optional().default([]),
    successSignal: z.string().max(500).optional().default(""),
    currentContext: z.string().max(1000).optional().default(""),
    domainHint: z.string().optional().nullable(),
    tier: z.enum(["starter", "growth", "ultimate"]).optional(),
    mode: z.enum(["individual", "team"]).optional(),
  })
  .transform((data) => {
    const country = data.location?.country ?? data.locationCountry ?? "Unknown";
    const blueprintId = data.blueprintId;
    const idempotencyKey =
      data.idempotencyKey ??
      data.idempotency_key ??
      (blueprintId ? `erector-run:${blueprintId}:${Date.now()}` : `erector-run:${Date.now()}`);
    const businessModel = data.businessModel;
    return {
      blueprintId,
      idempotencyKey,
      rawGoal: data.rawGoal,
      purpose: data.purpose,
      timeframe: data.timeframe,
      customTimeframeDays: data.customTimeframeDays,
      commitmentLevel: data.commitmentLevel,
      desiredOutcome: data.desiredOutcome?.trim() ? data.desiredOutcome : data.purpose,
      location: { country, city: data.location?.city },
      businessType: data.businessType,
      businessModel,
      budgetAvailable: data.budgetAvailable ?? 0,
      currency: data.currency,
      currentResources: data.currentResources ?? [],
      targetCustomer: data.targetCustomer?.trim() ? data.targetCustomer : data.rawGoal,
      knownBlockers: data.knownBlockers ?? [],
      successSignal: data.successSignal?.trim() ? data.successSignal : undefined,
      currentContext: data.currentContext?.trim()
        ? data.currentContext
        : `Building ${businessModel} in ${country}`,
      domainHint: data.domainHint,
      tier: data.tier,
      mode: data.mode,
    };
  });

const goalInputSchema = z.object({
  blueprintId: z.string().uuid(),
  goal: z.string().min(5).max(500),
  purpose: z.string().max(1000).optional(),
  timeframe: z.string().max(200).optional(),
  commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional(),
  currentContext: z.string().max(1000).optional(),
  successSignal: z.string().max(500).optional(),
  knownBlockers: z.string().max(500).optional(),
  domainHint: z.string().optional(),
  tier: z.enum(["starter", "growth", "ultimate"]).optional(),
  mode: z.enum(["individual", "team"]).optional(),
});

// POST /api/v1/validation/run — full Erector validation run.
router.post("/v1/validation/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = erectorValidationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("[RUN_FAILURE]", { userId: auth.userId, reason: "invalid_input", issues: parsed.error.issues });
      failure(res, "VALIDATION_ERROR", "Invalid Erector validation input", 422);
      return;
    }

    let blueprintId = parsed.data.blueprintId;
    if (!blueprintId) {
      const { db, blueprints } = await import("@workspace/db");
      const { and, desc, eq, inArray } = await import("drizzle-orm");
      const [draft] = await db
        .select({ id: blueprints.id })
        .from(blueprints)
        .where(
          and(
            eq(blueprints.user_id, auth.userId),
            inArray(blueprints.status, ["draft", "validating", "path_selection", "awaiting_selection"]),
          ),
        )
        .orderBy(desc(blueprints.updated_at))
        .limit(1);
      blueprintId = draft?.id;
    }
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId is required (or create a goal draft first)", 422);
      return;
    }

    const { db: refineDb, validations: refineValidations, blueprints } = await import("@workspace/db");
    const { and: refineAnd, desc: refineDesc, eq: refineEq } = await import("drizzle-orm");
    const [refineRow] = await refineDb
      .select()
      .from(refineValidations)
      .where(refineAnd(refineEq(refineValidations.blueprint_id, blueprintId), refineEq(refineValidations.user_id, auth.userId)))
      .orderBy(refineDesc(refineValidations.created_at))
      .limit(1);

    const [bpRow] = await refineDb
      .select({ goal_final: blueprints.goal_final, purpose_final: blueprints.purpose_final, refinement_status: blueprints.refinement_status })
      .from(blueprints)
      .where(refineEq(blueprints.id, blueprintId))
      .limit(1);

    const goalFinal = refineRow?.goal_final ?? bpRow?.goal_final ?? parsed.data.rawGoal;
    const purposeFinal = refineRow?.purpose_final ?? bpRow?.purpose_final ?? parsed.data.purpose;
    const useTwentyStage =
      Boolean(goalFinal && purposeFinal) &&
      (bpRow?.refinement_status === "complete" || refineRow?.refinement_locked);

    if (useTwentyStage) {
      try {
        if (refineRow) ErectorRefinementService.assertReadyForValidation(refineRow);
      } catch (refineErr) {
        failure(
          res,
          "VALIDATION_ERROR",
          refineErr instanceof Error ? refineErr.message : "Complete goal/purpose refinement and validation feed first",
          422,
        );
        return;
      }
    }

    console.log("[RUN_START]", {
      userId: auth.userId,
      blueprintId,
      idempotencyKey: parsed.data.idempotencyKey,
      pipeline: useTwentyStage ? "20_stage" : "legacy_erector",
    });

    let validationId: string;
    let result: Awaited<ReturnType<typeof runErectorValidation>> | null = null;

    if (useTwentyStage) {
      const tfFields = resolveValidationTimeframeFields({
        timeframe: parsed.data.timeframe,
        customTimeframeDays:
          parsed.data.customTimeframeDays ?? refineRow?.timeframe_days ?? undefined,
        timeframeStart: refineRow?.timeframe_start,
        timeframeEnd: refineRow?.timeframe_end,
      });
      const startIso =
        refineRow?.timeframe_start?.toISOString?.().slice(0, 10) ??
        new Date().toISOString().slice(0, 10);
      const endDate = new Date(startIso);
      endDate.setDate(endDate.getDate() + (tfFields.timeframe_days ?? 90));
      const endIso = refineRow?.timeframe_end?.toISOString?.().slice(0, 10) ?? endDate.toISOString().slice(0, 10);

      const feed: ValidationFeedInput = {
        blueprintId,
        userId: auth.userId,
        idempotencyKey: parsed.data.idempotencyKey,
        goal_final: goalFinal,
        purpose_final: purposeFinal,
        country: refineRow?.location_country ?? parsed.data.location.country,
        economic_type: refineRow?.economic_type ?? undefined,
        business_type: refineRow?.business_type ?? parsed.data.businessModel,
        business_model: refineRow?.business_model ?? parsed.data.businessModel,
        commitment_level: refineRow?.commitment_level ?? parsed.data.commitmentLevel,
        budget: refineRow?.budget_available ?? parsed.data.budgetAvailable,
        resources: (refineRow?.current_resources as string[]) ?? parsed.data.currentResources,
        target_customer: refineRow?.target_customer ?? parsed.data.targetCustomer,
        currency: refineRow?.currency ?? parsed.data.currency,
        location_city: refineRow?.location_city ?? parsed.data.location.city,
        tier: parsed.data.tier,
        timeframe_start: startIso,
        timeframe_end: endIso,
        timeframe_days: tfFields.timeframe_days ?? undefined,
      };
      const run = await runErectorTwentyStages(feed);
      validationId = run.validationId;
    } else {
      result = await runErectorValidation({
        ...parsed.data,
        blueprintId,
        userId: auth.userId,
        rawGoal: refineRow?.raw_goal ?? parsed.data.rawGoal,
        goalFinal,
        purposeFinal,
        purpose: purposeFinal,
        location: {
          country: refineRow?.location_country ?? parsed.data.location.country,
          city: refineRow?.location_city ?? parsed.data.location.city,
        },
        businessType: (refineRow?.business_type as "online" | "offline" | "hybrid") ?? parsed.data.businessType,
        businessModel: refineRow?.business_model ?? parsed.data.businessModel,
        budgetAvailable: refineRow?.budget_available ?? parsed.data.budgetAvailable,
        targetCustomer: refineRow?.target_customer ?? parsed.data.targetCustomer,
        currentResources: (refineRow?.current_resources as string[]) ?? parsed.data.currentResources,
      });
      validationId = result.validationId;
    }
    await SequenceTrackingService.recordContext(blueprintId, parsed.data.tier, {
      timeframe: parsed.data.customTimeframeDays ?? undefined,
      location: parsed.data.location.country,
      businessType: parsed.data.businessType,
      commitment: parsed.data.commitmentLevel,
      budget: parsed.data.budgetAvailable,
    }).catch(() => null);
    const { db: runDb, validations: runValidations } = await import("@workspace/db");
    const { sql: runSql, eq: runEq } = await import("drizzle-orm");
    const [finalRow] = await runDb.select().from(runValidations).where(runEq(runValidations.id, validationId)).limit(1);
    const tfPatch = resolveValidationTimeframeFields({
      timeframe: parsed.data.timeframe,
      customTimeframeDays: parsed.data.customTimeframeDays,
      timeframeStart: finalRow?.timeframe_start,
      timeframeEnd: finalRow?.timeframe_end,
    });
    if (finalRow && (!finalRow.timeframe?.trim() || finalRow.timeframe_days == null) && tfPatch.timeframe_days) {
      await runDb
        .update(runValidations)
        .set({
          timeframe: finalRow.timeframe?.trim() ? finalRow.timeframe : tfPatch.timeframe,
          timeframe_days: finalRow.timeframe_days ?? tfPatch.timeframe_days,
          commitment_level: finalRow.commitment_level ?? parsed.data.commitmentLevel,
          location_country: finalRow.location_country ?? parsed.data.location.country,
          location_context: finalRow.location_context ?? parsed.data.location.country,
          domain: finalRow.domain ?? parsed.data.domainHint ?? null,
          current_context: finalRow.current_context ?? parsed.data.currentContext ?? null,
        })
        .where(runEq(runValidations.id, validationId));
    }
    const verdictForSeq = result?.verdict ?? finalRow?.verdict ?? "adjust";
    await SequenceTrackingService.recordValidation(blueprintId, parsed.data.tier, {
      verdict: verdictForSeq,
      realityScore: result?.scores.realityScore ?? finalRow?.reality_score ?? undefined,
      paths: (result?.paths ?? {
        current: finalRow?.path_current,
        adjusted: finalRow?.path_adjusted,
        alternative: finalRow?.path_alternative,
      }) as unknown as Record<string, unknown>,
      feasibility: result?.scores.realityScore ?? finalRow?.reality_score ?? undefined,
    }).catch(() => null);
    const redirectTo = `/validation/${validationId}/results`;
    const [runCount] = await runDb
      .select({ count: runSql<number>`count(*)::int` })
      .from(runValidations)
      .catch(() => [{ count: -1 }]);
    console.log("[VALIDATION RUN] Created validation ID:", validationId);
    console.log("[VALIDATION RUN] DB confirmed write — count now:", runCount?.count ?? "unknown");

    const verdict = result?.verdict ?? finalRow?.verdict ?? "adjust";

    console.log("[RUN_SUCCESS]", { validationId, verdict, redirectTo });
    success(res, {
      success: true,
      validationId,
      validationContractId: finalRow?.contract_id ?? result?.validationContractId,
      blueprintId,
      verdict,
      result: result ?? { validationId, blueprintId, verdict },
      redirectTo,
      pipeline: useTwentyStage ? "20_stage" : "legacy",
    });
  } catch (err) {
    logSchemaDbError("select|insert|update", "validations", err, {
      route: "POST /api/v1/validation/run",
    });
    const message = err instanceof Error ? err.message : String(err);
    console.error("[RUN_FAILURE]", { error: message });
    handleError(req, res, err);
  }
});

// GET /api/v1/validation/archetypes — reference data for country/context selectors.
router.get("/v1/validation/archetypes", async (_req, res) => {
  try {
    const { db, economicArchetypes } = await import("@workspace/db");
    const rows = await db.select().from(economicArchetypes).catch(() => []);
    success(res, rows.length > 0 ? rows : ERECTOR_ARCHETYPE_SEEDS);
  } catch (err) {
    handleError(_req, res, err);
  }
});

// GET /api/v1/validation/active-draft — Prompt 6 validation route group guard.
router.get("/v1/validation/active-draft", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, blueprints } = await import("@workspace/db");
    const { and, desc, eq, inArray } = await import("drizzle-orm");
    const [draft] = await db
      .select({
        id: blueprints.id,
        status: blueprints.status,
        validation_id: blueprints.validation_id,
        erector_validation_id: blueprints.erector_validation_id,
      })
      .from(blueprints)
      .where(
        and(
          eq(blueprints.user_id, auth.userId),
          inArray(blueprints.status, ["draft", "validating", "path_selection", "awaiting_selection"]),
        ),
      )
      .orderBy(desc(blueprints.updated_at))
      .limit(1);
    if (!draft) {
      success(res, null);
      return;
    }
    success(res, {
      blueprintId: draft.id,
      status: draft.status,
      validationId: draft.validation_id,
      erectorValidationId: draft.erector_validation_id,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/validation/:id — polling endpoint for Erector stage/result screens.
router.get("/v1/validation/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    success(res, {
      validationId: row.id,
      validationContractId: row.contract_id,
      launchBlocked: row.launch_blocked ?? false,
      blueprintId: row.blueprint_id,
      validationStage: row.validation_stage ?? row.status,
      status: row.status,
      verdict: row.verdict,
      realityScore: row.reality_score,
      recommendedBlueprintLevel: row.recommended_blueprint_level,
      rawGoal: row.raw_goal,
      purpose: row.purpose,
      targetCustomer: row.target_customer,
      desiredOutcome: row.desired_outcome,
      timeframe: row.timeframe,
      timeframeDays: row.timeframe_days,
      commitmentLevel: row.commitment_level,
      locationCountry: row.location_country,
      businessModel: row.business_model,
      domain: row.domain,
      currentContext: row.current_context,
      isFinalized: row.is_finalized ?? false,
      knownBlockers: row.known_blockers ?? [],
      industryPros: row.industry_pros ?? [],
      industryCons: row.industry_cons ?? [],
      scores: {
        marketScore: row.market_score,
        executionScore: row.execution_score,
        timingScore: row.timing_score,
        competitionScore: row.competition_score,
        scalabilityScore: row.scalability_score,
        localEconomyScore: row.local_economy_score,
        resourceScore: row.resource_score,
        blueprintDifficultyScore: row.blueprint_difficulty_score,
        riskScore: row.risk_score,
        momentumPotential: row.momentum_potential,
        trustBuildingScore: row.trust_building_score,
        realityScore: row.reality_score,
      },
      archetypeResolution: row.archetype_resolution,
      economyBriefing: row.economy_briefing,
      paths: { current: row.path_current, adjusted: row.path_adjusted, alternative: row.path_alternative },
      timeSimulations: row.time_simulations,
      firstWeekPlan: row.first_week_plan,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/validations/:id/status — polling for onboarding validating screen
router.get("/v1/validations/:id/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ id: validations.id, status: validations.status, user_id: validations.user_id })
      .from(validations)
      .where(eq(validations.id, req.params.id))
      .limit(1);
    if (!row || row.user_id !== auth.userId) {
      success(res, { status: "running", progress: 0 });
      return;
    }
    const status = String(row.status ?? "running");
    success(res, { status, progress: validationProgressFromStatus(status) });
  } catch (err) {
    success(res, { status: "running", progress: 0 });
  }
});

// GET /api/v1/validations/:id/report — PDF validation report
router.get("/v1/validations/:id/report", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { generateValidationReportPdf, reportFilename } = await import(
      "../lib/generateValidationReportPdf.js"
    );
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const pdf = await generateValidationReportPdf(row);
    const filename = reportFilename(row);
    await db
      .update(validations)
      .set({ report_generated_at: new Date() } as never)
      .where(eq(validations.id, row.id))
      .catch(() => null);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/validations/:id/results — shaped payload for results dashboard
router.get("/v1/validations/:id/results", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    success(res, buildOnboardingValidationResultsPayload(row));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/validation/resolve-archetype — preview economy mapping for a country/city.
router.post("/v1/validation/resolve-archetype", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const schema = z.object({
      country: z.string().min(2).max(120),
      city: z.string().max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid archetype resolution input", 422);
      return;
    }
    const resolution = await resolveArchetype(parsed.data.country, parsed.data.city);
    success(res, resolution);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/validation/:id/scores — 11-score dashboard payload.
router.get("/v1/validation/:id/scores", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await loadOwnedErectorValidation(req.params.id, auth.userId);
    if (!row) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    success(res, {
      validationId: row.id,
      verdict: row.verdict,
      realityScore: row.reality_score,
      recommendedBlueprintLevel: row.recommended_blueprint_level,
      scores: {
        marketScore: row.market_score,
        executionScore: row.execution_score,
        timingScore: row.timing_score,
        competitionScore: row.competition_score,
        scalabilityScore: row.scalability_score,
        localEconomyScore: row.local_economy_score,
        resourceScore: row.resource_score,
        blueprintDifficultyScore: row.blueprint_difficulty_score,
        riskScore: row.risk_score,
        momentumPotential: row.momentum_potential,
        trustBuildingScore: row.trust_building_score,
        realityScore: row.reality_score,
        verdict: row.verdict,
        recommendedBlueprintLevel: row.recommended_blueprint_level,
      },
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/validation/:id/competitors
router.get("/v1/validation/:id/competitors", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await loadOwnedErectorValidation(req.params.id, auth.userId);
    if (!row) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    success(res, row.competitor_analysis ?? row.winner_analysis ?? {});
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/validation/:id/simulation
router.get("/v1/validation/:id/simulation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await loadOwnedErectorValidation(req.params.id, auth.userId);
    if (!row) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    success(res, {
      timeSimulations: row.time_simulations ?? [],
      executionDifficulty: row.execution_difficulty ?? {},
      timingAnalysis: row.timing_analysis ?? {},
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/validation/:id/first-week
router.get("/v1/validation/:id/first-week", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await loadOwnedErectorValidation(req.params.id, auth.userId);
    if (!row) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    if (row.first_week_plan) {
      success(res, { first_week_plan: row.first_week_plan });
      return;
    }
    const selected = row.selected_path_type ?? row.selected_path;
    if (!selected) {
      failure(res, "NOT_FOUND", "First week plan is available after path selection.", 404);
      return;
    }
    const selectedPath = selected as "current" | "adjusted" | "alternative";
    const firstWeekPlan = await persistFirstWeekPlan(row, auth.userId, selectedPath);
    success(res, { first_week_plan: firstWeekPlan });
  } catch (err) {
    handleError(req, res, err);
  }
});

async function handleValidationSelectPath(
  req: import("express").Request,
  res: import("express").Response,
  validationId: string,
) {
  const auth = await requireAuth(req, "USER_SESSION");
  const schema = z.object({ selectedPath: z.enum(["current", "adjusted", "alternative"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    failure(res, "VALIDATION_ERROR", "Invalid path selection", 422);
    return;
  }
  const row = await loadOwnedErectorValidation(validationId, auth.userId);
  if (!row) {
    failure(res, "NOT_FOUND", "Validation not found", 404);
    return;
  }
  const selected = parsed.data.selectedPath;

  if (row.validation_kind !== ValidationKind.ERECTOR) {
    const out = await ValidationService.selectValidationPath({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
      selectedPath: selected,
      validationContractId: row.contract_id,
      validationIdHint: row.id,
      confirmAdjusted: selected === "adjusted",
    });
    success(res, {
      validation_id: row.id,
      validation_contract_id: row.contract_id,
      selected_path: selected,
      blueprintId: row.blueprint_id,
      ...out,
    });
    return;
  }

  if (row.verdict === "blocked") {
      failure(res, "VALIDATION_ERROR", "Launch blocked: Reality Score below 2.5. Re-validate your goal.", 422);
      return;
    }
    if ((row.verdict === "pivot" || (row.reality_score != null && row.reality_score < 4)) && selected === "current") {
      failure(res, "VALIDATION_ERROR", "Current path cannot launch when Reality Score requires pivot.", 422);
      return;
    }
    const { db, validations, blueprints } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await db
      .update(validations)
      .set({
        selected_path: selected,
        selected_path_type: selected,
        selected_at: new Date(),
        adjusted_path_confirmed: selected === "adjusted" || selected === "alternative",
      })
      .where(eq(validations.id, row.id));
    const firstWeekPlan = await persistFirstWeekPlan(row, auth.userId, selected);
    const [bp] = await db.select({ tier: blueprints.tier }).from(blueprints).where(eq(blueprints.id, row.blueprint_id)).limit(1);

    await transitionBlueprintToPathSelection({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
      validationId: row.id,
      verdict: row.verdict,
      selectedPath: selected,
      realityScore: row.reality_score,
      intelligencePayload: (row.intelligence_payload as Record<string, unknown> | null) ?? null,
      pathOptions: {
        current: row.path_current,
        adjusted: row.path_adjusted,
        alternative: row.path_alternative,
      },
      recommendedTier: row.recommended_blueprint_level ?? bp?.tier ?? "starter",
      validationKind: row.validation_kind,
    });

    await SequenceTrackingService.recordValidationResult(row.blueprint_id, bp?.tier, selected).catch(() => null);

    await writeEvent({
      eventType: EventTypes.ERECTOR_PATH_SELECTED,
      entityType: "validation",
      entityId: row.id,
      userId: auth.userId,
      blueprintId: row.blueprint_id,
      payload: { validationId: row.id, selectedPath: selected, contract_id: row.contract_id },
      idempotencyKey: `erector_path_selected:${row.id}:${selected}`,
    }).catch(() => null);
    success(res, {
      validation_id: row.id,
      validation_contract_id: row.contract_id,
      selected_path: selected,
      recommended_blueprint_level: row.recommended_blueprint_level ?? "starter",
      first_week_plan: firstWeekPlan,
    });
}

// POST /api/v1/validation/:id/select-path — record path (intelligence + Erector)
router.post("/v1/validation/:id/select-path", async (req, res) => {
  try {
    await handleValidationSelectPath(req, res, String(req.params.id ?? ""));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/validations/:id/select-path — plural alias (onboarding / results)
router.post("/v1/validations/:id/select-path", async (req, res) => {
  try {
    await handleValidationSelectPath(req, res, String(req.params.id ?? ""));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/validation/:id/first-week — deterministic first-week plan.
router.post("/v1/validation/:id/first-week", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await loadOwnedErectorValidation(req.params.id, auth.userId);
    if (!row) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const selectedPath = (row.selected_path_type ?? row.selected_path ?? "adjusted") as "current" | "adjusted" | "alternative";
    const firstWeekPlan = await persistFirstWeekPlan(row, auth.userId, selectedPath);
    success(res, { first_week_plan: firstWeekPlan });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/validation/start
router.post("/validation/start", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = goalInputSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;
    const session = await ValidationService.startValidation({
      blueprintId: input.blueprintId,
      userId: auth.userId,
      tier: input.tier,
      mode: input.mode,
      input: {
        goal: input.goal,
        purpose: input.purpose,
        timeframe: input.timeframe,
        commitmentLevel: input.commitmentLevel,
        currentContext: input.currentContext,
        successSignal: input.successSignal,
        knownBlockers: input.knownBlockers,
        domainHint: input.domainHint,
      },
    });
    success(res, session);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/validation/run — Run or re-run validation
router.post("/validation/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = goalInputSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;
    const result = await ValidationService.validateGoal({
      blueprintId: input.blueprintId,
      userId: auth.userId,
      tier: input.tier,
      mode: input.mode,
      input: {
        goal: input.goal,
        purpose: input.purpose,
        timeframe: input.timeframe,
        commitmentLevel: input.commitmentLevel,
        currentContext: input.currentContext,
        successSignal: input.successSignal,
        knownBlockers: input.knownBlockers,
        domainHint: input.domainHint,
      },
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/run?blueprintId=...
router.get("/validation/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query["blueprintId"] as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId query parameter required", 422);
      return;
    }
    const result = await ValidationService.getValidationResult({ blueprintId, userId: auth.userId });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id/timeline — live validation stage log (polling)
router.get("/validation/:id/timeline", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { getValidationTimeline } = await import(
      "../engines/validation/ValidationEventLogService.js"
    );
    const [row] = await db
      .select()
      .from(validations)
      .where(eq(validations.id, req.params.id))
      .limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const events = await getValidationTimeline(req.params.id);
    success(res, { validationId: req.params.id, status: row.status, events });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id/status
router.get("/validation/:id/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const status = await ValidationService.getValidationStatus(req.params.id, auth.userId);
    success(res, status);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id/result — by validation session id (Erector + Intelligence)
router.get("/validation/:id/result", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }

    if (row.validation_kind === ValidationKind.ERECTOR) {
      const { competitorsFromValidationRow, userGoalFromRow, userPurposeFromRow } = await import(
        "../lib/mapValidationIntel.js"
      );
      const shaped = buildOnboardingValidationResultsPayload(row);
      const erector = rowToErectorResult(row);
      const competitors = shaped.competitors;
      const userPurpose = userPurposeFromRow(row);
      const userGoal = userGoalFromRow(row);
      const competitorAnalysis = { competitors };
      success(res, {
        ...shaped,
        validationId: row.id,
        validationContractId: row.contract_id,
        blueprintId: row.blueprint_id,
        goal: userGoal,
        purpose: userPurpose,
        verdict: row.verdict ?? shaped.verdict ?? "adjust",
        launchBlocked: row.launch_blocked ?? false,
        isFinalized: row.is_finalized ?? false,
        paths: erector.paths ?? shaped.paths,
        intelligence: {
          erector: {
            ...erector,
            rawGoal: userGoal,
            raw_goal: userGoal,
            purpose: userPurpose,
            competitors,
            opportunities: shaped.opportunities,
            economicContext: shaped.economicContext,
            competitor_analysis: competitorAnalysis,
            competitorAnalysis,
            timeframe: row.timeframe,
            timeframeDays: row.timeframe_days,
            timeframe_days: row.timeframe_days,
            commitmentLevel: row.commitment_level,
            locationCountry: row.location_country,
            location_country: row.location_country,
            businessModel: row.business_model,
            business_model: row.business_model,
            domain: row.domain,
            currentContext: row.current_context,
          },
        },
      });
      return;
    }

    const result = await ValidationService.getValidationResult({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/validation/:id/select-path
router.post("/validation/:id/select-path", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z.object({
      selectedPath: z.enum(["current", "adjusted", "alternative"]),
      confirmAdjusted: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const out = await ValidationService.selectValidationPath({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
      selectedPath: parsed.data.selectedPath,
      validationContractId: row.contract_id,
      confirmAdjusted: parsed.data.confirmAdjusted,
    });
    success(res, out);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/validation/:id/edit-inputs — re-run via blueprint id on session
router.post("/validation/:id/edit-inputs", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = goalInputSchema.omit({ blueprintId: true }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const result = await ValidationService.validateGoal({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
      tier: parsed.data.tier,
      mode: parsed.data.mode,
      input: {
        goal: parsed.data.goal,
        purpose: parsed.data.purpose,
        timeframe: parsed.data.timeframe,
        commitmentLevel: parsed.data.commitmentLevel,
        currentContext: parsed.data.currentContext,
        successSignal: parsed.data.successSignal,
        knownBlockers: parsed.data.knownBlockers,
        domainHint: parsed.data.domainHint,
      },
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const validationFinalizeHandler = async (req: import("express").Request, res: import("express").Response) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const validationId = String(req.params.id ?? "").trim();
    if (!validationId) {
      failure(res, "NOT_FOUND", "Validation id is required", 404);
      return;
    }
    const body = (req.body ?? {}) as { selectedPath?: string; selected_path?: string };
    const pathRaw = body.selectedPath ?? body.selected_path;
    const path =
      pathRaw === "current" || pathRaw === "adjusted" || pathRaw === "alternative" ? pathRaw : undefined;

    const { ValidationFinalizationService } = await import("../services/ValidationFinalizationService.js");
    const row = await ValidationFinalizationService.finalizeValidation(validationId, auth.userId, {
      selectedPath: path,
    });
    success(res, {
      validationId: row.id,
      finalized: true,
      finalizedAt: row.finalized_at,
      selectedPath: row.selected_path_type ?? row.selected_path,
      isFinalized: row.is_finalized,
    });
  } catch (err) {
    handleError(req, res, err);
  }
};

// POST /api/v1/validations/:id/finalize — lock validation for blueprint handoff
router.post("/v1/validations/:id/finalize", validationFinalizeHandler);

// POST /api/v1/validation/:id/finalize — singular alias
router.post("/v1/validation/:id/finalize", validationFinalizeHandler);

// POST /api/v1/validations/:id/launch — canonical launch from completed validation
router.post("/v1/validations/:id/launch", validationLaunchHandler);

// POST /api/v1/validation/:id/launch — singular alias (matches other v1 validation routes)
router.post("/v1/validation/:id/launch", validationLaunchHandler);

// POST /api/v1/onboarding/select-blueprint — tier selection launch (also on onboarding router)
router.post("/v1/onboarding/select-blueprint", selectBlueprintLaunchHandler);
router.post("/onboarding/select-blueprint", selectBlueprintLaunchHandler);

// GET /api/validation/:id/industry-intelligence
router.get("/validation/:id/industry-intelligence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const panel = await ValidationService.getIndustryIntelligence(row.blueprint_id, auth.userId);
    success(res, panel);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
