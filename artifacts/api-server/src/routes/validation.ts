import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { ValidationService } from "../services/ValidationService.js";
import { success, failure, handleError } from "../lib/utils.js";
import { runErectorValidation } from "../engines/erector/ErectorOrchestrationService.js";
import { ERECTOR_ARCHETYPE_SEEDS } from "../engines/erector/archetypeData.js";
import { writeEvent } from "../services/EventService.js";
import { EventTypes } from "../types/eventContracts.js";
import { emitErectorFirstWeekGenerated } from "../engines/erector/emitErectorEvents.js";
import { generateFirstWeek } from "../engines/erector/PathEngine.js";
import { resolveArchetype } from "../engines/erector/ArchetypeResolutionEngine.js";
import type { ErectorValidationInput } from "../types/erector.js";

const router = Router();

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
    purpose: row.purpose ?? row.desired_outcome ?? "Execution purpose",
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

const erectorValidationInputSchema = z.object({
  blueprintId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
  rawGoal: z.string().min(5).max(500),
  purpose: z.string().min(3).max(1000),
  timeframe: z.string().min(1).max(80),
  customTimeframeDays: z.number().int().positive().optional(),
  commitmentLevel: z.string().min(2).max(20),
  desiredOutcome: z.string().min(3).max(500),
  location: z.object({
    country: z.string().min(2).max(120),
    city: z.string().max(120).optional(),
  }),
  businessType: z.enum(["online", "offline", "hybrid"]),
  businessModel: z.string().min(2).max(120),
  budgetAvailable: z.number().min(0),
  currency: z.string().min(2).max(12),
  currentResources: z.array(z.string().min(1).max(80)).min(1),
  targetCustomer: z.string().min(3).max(500),
  knownBlockers: z.array(z.string().min(1).max(200)).optional(),
  successSignal: z.string().max(500).optional(),
  currentContext: z.string().max(1000).optional(),
  domainHint: z.string().optional().nullable(),
  tier: z.enum(["starter", "growth", "ultimate"]).optional(),
  mode: z.enum(["individual", "team"]).optional(),
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
      console.error("[RUN_FAILURE]", { userId: auth.userId, reason: "invalid_input" });
      failure(res, "VALIDATION_ERROR", "Invalid Erector validation input", 422);
      return;
    }
    console.log("[RUN_START]", {
      userId: auth.userId,
      blueprintId: parsed.data.blueprintId,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    const result = await runErectorValidation({ ...parsed.data, userId: auth.userId });
    const redirectTo = "/onboarding";
    console.log("[RUN_SUCCESS]", {
      validationId: result.validationId,
      verdict: result.verdict,
      redirectTo,
    });
    success(res, {
      success: true,
      validationId: result.validationId,
      validationContractId: result.validationContractId,
      blueprintId: result.blueprintId,
      verdict: result.verdict,
      result,
      redirectTo,
    });
  } catch (err) {
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
      commitmentLevel: row.commitment_level,
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

// POST /api/v1/validation/:id/select-path — record selected Erector path and generate first-week plan.
router.post("/v1/validation/:id/select-path", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z.object({ selectedPath: z.enum(["current", "adjusted", "alternative"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid path selection", 422);
      return;
    }
    const row = await loadOwnedErectorValidation(req.params.id, auth.userId);
    if (!row) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const selected = parsed.data.selectedPath;
    if (row.verdict === "blocked") {
      failure(res, "VALIDATION_ERROR", "Launch blocked: Reality Score below 2.5. Re-validate your goal.", 422);
      return;
    }
    if ((row.verdict === "pivot" || (row.reality_score != null && row.reality_score < 4)) && selected === "current") {
      failure(res, "VALIDATION_ERROR", "Current path cannot launch when Reality Score requires pivot.", 422);
      return;
    }
    const { db, validations } = await import("@workspace/db");
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

// GET /api/validation/:id/result — by validation session id (resolves blueprint)
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
