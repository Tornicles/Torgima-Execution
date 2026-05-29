import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { db, users, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import { success, failure, handleError } from "../lib/utils.js";
import { adaptOnboardingGoalRequest, flatToParsedGoal } from "../lib/onboardingGoalAdapter.js";
import { logSchemaDbError } from "../lib/schemaDbDiagnostics.js";

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

// POST /api/onboarding/goal — persist refined goal/purpose + context (validation runs separately)
router.post("/onboarding/goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const body = req.body ?? {};
    const adapted = adaptOnboardingGoalRequest(body);

    if (!adapted.ok) {
      failure(res, "VALIDATION_ERROR", "Invalid onboarding goal payload", 400, {
        fieldErrors: adapted.fieldErrors,
      });
      return;
    }

    const { flat, rawGoal, rawPurpose } = adapted.data;
    req.log.info(
      {
        shape: "flat",
        timeframe: flat.timeframe,
        commitmentLevel: flat.commitmentLevel,
        hasRawGoal: Boolean(rawGoal),
        hasRawPurpose: Boolean(rawPurpose),
      },
      "[Onboarding] POST /onboarding/goal normalized payload",
    );

    const input = flatToParsedGoal(adapted.data);
    const refinedGoal = flat.goal;
    const refinedPurpose = flat.purpose;
    const rawGoalInput = rawGoal ?? refinedGoal;
    const rawPurposeInput = rawPurpose ?? refinedPurpose;

    const tier = input.selectedBlueprintTier;
    const mode = input.selectedBlueprintMode;

    const [inserted] = await db
      .insert(blueprints)
      .values({
        user_id: auth.userId,
        goal: refinedGoal,
        purpose: refinedPurpose,
        raw_goal: rawGoalInput,
        raw_goal_input: rawGoalInput,
        raw_purpose: rawPurposeInput,
        raw_purpose_input: rawPurposeInput,
        goal_final: refinedGoal,
        purpose_final: refinedPurpose,
        timeframe_days: input.timeframeDays,
        commitment_level: input.commitmentLevel,
        domain_hint: flat.domain,
        domain: flat.domain,
        current_context: flat.currentContext ?? null,
        success_signal: null,
        known_blockers: null,
        selected_blueprint_level: tier,
        tier,
        mode,
        status: "draft",
        active: false,
        blueprint_config: {},
        metadata: {},
      })
      .returning({ id: blueprints.id });

    if (!inserted?.id) {
      throw new Error("Blueprint insert did not return an id");
    }

    success(res, { blueprintId: inserted.id, status: "draft" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Onboarding] POST /api/onboarding/goal", message, stack);
    console.error(err);
    logSchemaDbError("insert", "blueprints", err, { route: "POST /api/onboarding/goal" });
    handleError(req, res, err);
  }
});

export default router;
