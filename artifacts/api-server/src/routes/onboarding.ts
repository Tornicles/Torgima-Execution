import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { ValidationService } from "../services/ValidationService.js";
import { db, users, blueprints, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { success, failure, handleError } from "../lib/utils.js";

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

    const schema = z.object({
      rawGoal:         z.string().min(5).max(2000),
      purpose:         z.string().max(1000).optional(),
      timeframe:       z.string().max(200).optional(),
      commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional(),
      currentContext:  z.string().max(1000).optional(),
      successSignal:   z.string().max(500).optional(),
      knownBlockers:   z.string().max(500).optional(),
      domainHints:     z.array(z.string()).optional(),
      idempotencyKey:  z.string().min(1),
      tier:            z.enum(["starter", "growth", "ultimate"]).optional(),
      mode:            z.enum(["individual", "team"]).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }

    const input = parsed.data;

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
        b.status === "draft" ||
        b.status === "validating" ||
        b.status === "awaiting_selection" ||
        b.status === "path_selection",
    );

    let blueprintId: string;

    if (existing) {
      blueprintId = existing.id;
    } else {
      const { blueprintId: id } = await BlueprintService.create(auth.userId, {
        goal:            input.rawGoal,
        purpose:         input.purpose ?? null,
        domainHint:      input.domainHints?.[0] ?? null,
        commitmentLevel: input.commitmentLevel ?? null,
      });
      blueprintId = id;
    }

    // Structure goal
    const structured = await ValidationService.structureGoal({
      userId:    auth.userId,
      input:     { ...input, idempotencyKey: input.idempotencyKey },
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

    if (input.tier && input.mode) {
      await db
        .update(blueprints)
        .set({ tier: input.tier, mode: input.mode })
        .where(eq(blueprints.id, blueprintId));
    }

    // Run full validation (5 intelligence systems)
    const validationResult = await ValidationService.validateGoal({
      blueprintId,
      userId: auth.userId,
      tier: input.tier,
      mode: input.mode,
      input: {
        goal:            structured.cleanedGoal,
        purpose:         structured.purpose,
        timeframe:       structured.timeframe,
        commitmentLevel: structured.commitmentLevel,
        currentContext:  structured.currentContext,
        successSignal:   structured.successSignals[0],
        knownBlockers:   structured.blockers[0],
        domainHint:      input.domainHints?.[0] ?? null,
      },
    });

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
    handleError(req, res, err);
  }
});

export default router;
