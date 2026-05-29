import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { ValidationService } from "../services/ValidationService.js";
import { db, users, blueprints, featureFlags, validations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { success, failure, handleError } from "../lib/utils.js";
import { checkSchemaHealth } from "../lib/verifySchema.js";
import { BlueprintStatus } from "../types/stateMachine.js";
import { SequenceTrackingService } from "../services/SequenceTrackingService.js";
import { parseOnboardingGoalBody } from "../lib/onboardingGoalPayload.js";
import { resolveDefaultSelectedPath } from "../lib/validationPathSelection.js";

const router = Router();

// GET /api/onboarding/status
router.get("/onboarding/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const userRows = await db
      .select({ onboarding_complete: users.onboarding_complete })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);
    const onboardingComplete = userRows[0]?.onboarding_complete ?? false;

    const activeBlueprint = await BlueprintService.findActive(auth.userId);

    success(res, {
      completed:   onboardingComplete,
      step:        onboardingComplete ? "done" : "goal",
      blueprintId: activeBlueprint?.id ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

const onboardingCompleteBodySchema = z.object({}).strict();

// POST /api/onboarding/complete — Prompt 14
router.post("/onboarding/complete", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = onboardingCompleteBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid body", 400);
      return;
    }
    await db.update(users).set({ onboarding_complete: true }).where(eq(users.id, auth.userId));
    success(res, { onboardingComplete: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/onboarding/goal — Prompt 5 full validation flow
router.post("/onboarding/goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const parsed = parseOnboardingGoalBody(req.body);
    if (!parsed.ok) {
      failure(res, "VALIDATION_ERROR", "Invalid onboarding goal payload", 400, {
        fieldErrors: parsed.fieldErrors,
      });
      return;
    }

    const input = parsed.data;

    const schemaHealth = await checkSchemaHealth();
    if (!schemaHealth.ok) {
      res.status(503).json({
        ok: false,
        error: {
          code: "SCHEMA_OUTDATED",
          message: "Database schema is out of date. Run Drizzle migrations with: pnpm -F @workspace/db migrate",
          missing: schemaHealth.missing,
          details: schemaHealth.missing.join(", "),
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const selectedTier = input.selectedBlueprintTier ?? input.tier ?? "starter";
    const selectedMode = input.selectedBlueprintMode ?? input.mode ?? "individual";
    const domainHint = input.domain ?? input.domainHints?.[0] ?? null;
    const timeframeDays = input.timeframeDays;

    // AI feature flag
    const aiRows = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.feature_name, "ai_enabled"))
      .limit(1);
    const aiEnabled = aiRows[0]?.enabled ?? false;

    // Idempotency — reuse existing draft/validating/path_selection blueprint
    const existingRows = await db
      .select({ id: blueprints.id, status: blueprints.status })
      .from(blueprints)
      .where(eq(blueprints.user_id, auth.userId))
      .limit(20);

    const existing = existingRows.find(
      (b) =>
        b.status === BlueprintStatus.DRAFT ||
        b.status === BlueprintStatus.VALIDATING ||
        b.status === BlueprintStatus.AWAITING_SELECTION ||
        b.status === BlueprintStatus.PATH_SELECTION,
    );

    let blueprintId: string;

    if (existing) {
      blueprintId = existing.id;
    } else {
      const { blueprintId: id } = await BlueprintService.create(auth.userId, {
        goal:            input.rawGoal,
        purpose:         input.purpose,
        timeframeDays,
        domainHint,
        commitmentLevel: input.commitmentLevel,
      });
      blueprintId = id;
    }

    await db
      .update(blueprints)
      .set({
        raw_goal: input.rawGoal,
        purpose: input.purpose,
        timeframe_days: timeframeDays,
        commitment_level: input.commitmentLevel,
        domain_hint: domainHint,
        domain: domainHint,
        current_context: input.currentContext ?? null,
        success_signal: input.successSignal ?? null,
        known_blockers: input.knownBlockers ?? null,
        selected_blueprint_level: selectedTier,
        tier: selectedTier,
        mode: selectedMode,
      })
      .where(eq(blueprints.id, blueprintId));

    await SequenceTrackingService.ensureInitialized(blueprintId, selectedTier);

    // Structure goal
    const structured = await ValidationService.structureGoal({
      userId:      auth.userId,
      blueprintId,
      input:       { ...input, idempotencyKey: input.idempotencyKey },
      aiEnabled,
    });

    // Invalid — return early, no validation run
    if (structured.validationVerdict === "INVALID") {
      success(res, {
        status:        "invalid",
        structured,
        blueprintId,
        missingFields: structured.missingRequiredFields,
        ambiguityFlags: structured.ambiguityFlags,
        canProceed:    false,
      });
      return;
    }

    // Needs clarification — return early
    if (structured.validationVerdict === "NEEDS_CLARIFICATION") {
      success(res, {
        status:        "needs_clarification",
        structured,
        blueprintId,
        missingFields: structured.missingRequiredFields,
        canProceed:    false,
      });
      return;
    }

    await SequenceTrackingService.recordGoal(blueprintId, selectedTier, {
      goalText: input.rawGoal,
      structured: structured as unknown as Record<string, unknown>,
    });
    await SequenceTrackingService.recordPurpose(blueprintId, selectedTier, input.purpose);

    // Run full validation (5 intelligence systems)
    const validationResult = await ValidationService.validateGoal({
      blueprintId,
      userId: auth.userId,
      tier: selectedTier,
      mode: selectedMode,
      input: {
        goal:            structured.cleanedGoal,
        purpose:         structured.purpose,
        timeframe:       structured.timeframe,
        commitmentLevel: structured.commitmentLevel,
        currentContext:  structured.currentContext,
        successSignal:   structured.successSignals[0],
        knownBlockers:   structured.blockers[0],
        domainHint,
      },
    });

    const defaultPath = resolveDefaultSelectedPath(validationResult.verdict);

    await db
      .update(validations)
      .set({
        raw_goal: input.rawGoal,
        purpose: input.purpose,
        timeframe: input.timeframe,
        timeframe_days: timeframeDays,
        commitment_level: input.commitmentLevel,
        domain: domainHint,
        current_context: input.currentContext ?? null,
        success_signal: input.successSignal ?? null,
        known_blockers: input.knownBlockers ? [input.knownBlockers] : [],
        location_context: input.locationContext ?? null,
        reality_context: input.realityContext ?? null,
        selected_blueprint_tier: selectedTier,
        selected_blueprint_mode: selectedMode,
        selected_path: defaultPath,
        selected_path_type: defaultPath,
        selected_at: new Date(),
        overall_score: validationResult.scores.overall,
        scores: validationResult.scores as unknown as Record<string, unknown>,
        path_options: validationResult.paths as unknown as Record<string, unknown>,
        intelligence: validationResult.intelligence ?? null,
      })
      .where(eq(validations.id, validationResult.validationId));

    await SequenceTrackingService.recordValidation(blueprintId, selectedTier, {
      verdict: validationResult.verdict,
      realityScore: validationResult.scores?.overall,
      paths: validationResult.paths as Record<string, unknown>,
      feasibility: validationResult.scores?.feasibility?.score,
    }).catch(() => null);

    // Update user commitment level
    if (structured.commitmentLevel) {
      await db
        .update(users)
        .set({ commitment_level: structured.commitmentLevel as "low" | "medium" | "high" | "full" })
        .where(eq(users.id, auth.userId));
    }

    success(res, {
      status:       "validated",
      blueprintId,
      validationId: validationResult.validationId,
      validationContractId: validationResult.validationContractId,
      verdict:      validationResult.verdict,
      scores:       validationResult.scores,
      paths:        validationResult.paths,
      structured,
      canProceed:   !validationResult.launchBlocked && validationResult.verdict !== "pivot",
      launchBlocked: validationResult.launchBlocked,
      readiness: validationResult.readiness,
      industryPanel: validationResult.industryPanel,
      tabs: validationResult.tabs,
      intelligence: validationResult.intelligence,
      systemsProgress: validationResult.systemsProgress,
    });
  } catch (err) {
    req.log.error(
      {
        err,
        userId: (err as { userId?: string }).userId,
        message: err instanceof Error ? err.message : String(err),
      },
      "[Onboarding] POST /onboarding/goal failed",
    );
    handleError(req, res, err);
  }
});

export default router;
