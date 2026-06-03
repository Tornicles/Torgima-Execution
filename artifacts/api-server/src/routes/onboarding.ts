import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { ValidationLaunchService } from "../services/ValidationLaunchService.js";
import { ValidationService } from "../services/ValidationService.js";
import { db, users, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import { success, failure, handleError } from "../lib/utils.js";
import { isTorgimaError } from "../lib/errors.js";
import { adaptOnboardingGoalRequest, flatToParsedGoal } from "../lib/onboardingGoalAdapter.js";
import { normalizeProjectName } from "../lib/projectName.js";
import { logSchemaDbError } from "../lib/schemaDbDiagnostics.js";
import { logger } from "../lib/logger.js";

const pathTypeSchema = z.enum(["current", "adjusted", "alternative"]);
const tierSchema = z.enum(["starter", "growth", "ultimate"]);
const modeSchema = z.enum(["individual", "team"]);

const selectBlueprintLaunchBodySchema = z.object({
  validationId: z.string().uuid(),
  blueprintId: z.string().uuid().optional(),
  selectedTier: tierSchema,
  blueprintTier: tierSchema.optional(),
  selectedPath: pathTypeSchema.optional(),
  selected_path: pathTypeSchema.optional(),
  mode: modeSchema.optional(),
  projectName: z.string().min(3).max(50).optional(),
  project_name: z.string().min(3).max(50).optional(),
});

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
    const hasActiveBlueprint = Boolean(activeBlueprint);

    let onboardingStep: string = "welcome";
    if (hasActiveBlueprint) onboardingStep = "active";
    else if (onboardingComplete) onboardingStep = "done";
    else onboardingStep = "goal";

    success(res, {
      completed: onboardingComplete,
      onboardingComplete,
      hasActiveBlueprint,
      step: onboardingStep,
      onboardingStep,
      blueprintId: activeBlueprint?.id ?? null,
      activeBlueprintId: activeBlueprint?.id ?? null,
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

    const { flat, rawGoal, rawPurpose, projectName: adaptedProjectName } = adapted.data;
    const input = flatToParsedGoal(adapted.data, body as Record<string, unknown>);
    const refinedGoal = flat.goal;
    const refinedPurpose = flat.purpose;
    const rawGoalInput = rawGoal ?? refinedGoal;
    const rawPurposeInput = rawPurpose ?? refinedPurpose;
    const projectName = normalizeProjectName(adaptedProjectName, flat.domain);

    req.log.info(
      {
        shape: "flat",
        timeframe: flat.timeframe,
        commitmentLevel: flat.commitmentLevel,
        hasRawGoal: Boolean(rawGoal),
        hasRawPurpose: Boolean(rawPurpose),
        projectName,
      },
      "[Onboarding] POST /api/onboarding/goal normalized payload",
    );

    const tier = input.selectedBlueprintTier;
    const mode = input.selectedBlueprintMode;

    const timeframeStart = input.timeframeStart
      ? new Date(input.timeframeStart)
      : null;
    const timeframeEnd = input.timeframeEnd ? new Date(input.timeframeEnd) : null;

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
        project_name: projectName,
        timeframe_days: input.timeframeDays,
        timeframe_start: timeframeStart,
        timeframe_end: timeframeEnd,
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
    logger.error({ message, stack }, "[Onboarding] POST /api/onboarding/goal");
    logger.error({ err }, "[Onboarding] POST /api/onboarding/goal");
    logSchemaDbError("insert", "blueprints", err, { route: "POST /api/onboarding/goal" });
    handleError(req, res, err);
  }
});

// POST /api/v1/onboarding/select-blueprint — tier selection → full launch transaction
export const selectBlueprintLaunchHandler = async (
  req: import("express").Request,
  res: import("express").Response,
) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = selectBlueprintLaunchBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      failure(res, "VALIDATION_ERROR", detail || "Invalid select-blueprint body", 400);
      return;
    }

    const body = parsed.data;
    const validationId = body.validationId;
    const tier = body.blueprintTier ?? body.selectedTier;
    const selectedPath = body.selectedPath ?? body.selected_path ?? "adjusted";
    const mode = body.mode ?? "individual";
    const projectName = body.projectName ?? body.project_name;

    const row = await ValidationService.findValidationForBlueprint({
      blueprintId: body.blueprintId ?? "",
      userId: auth.userId,
      validationIdHint: validationId,
    });

    if (!row) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    if (!row.contract_id) {
      failure(res, "VALIDATION_ERROR", "Validation contract missing — complete validation first", 400);
      return;
    }

    const blueprintId = body.blueprintId ?? row.blueprint_id;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "Validation has no linked blueprint", 400);
      return;
    }

    logger.info(
      { validationId, blueprintId, tier, selectedPath, userId: auth.userId },
      "[SelectBlueprint] Launching from tier selection",
    );

    const result = await ValidationLaunchService.launch({
      validationId: row.id,
      userId: auth.userId,
      selectedPath: selectedPath,
      tier,
      mode,
      projectName,
      blueprintId,
    });

    await db.update(users).set({ onboarding_complete: true }).where(eq(users.id, auth.userId));

    success(res, {
      blueprintId: result.blueprintId,
      validationId: result.validationId,
      redirectTo: result.redirectTo,
      redirect_to: result.redirect_to,
      launched: result.launched,
      tier,
      selectedPath,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { message, stack: err instanceof Error ? err.stack : undefined },
      "[SelectBlueprint CRASH]",
    );
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

router.post("/v1/onboarding/select-blueprint", selectBlueprintLaunchHandler);
router.post("/onboarding/select-blueprint", selectBlueprintLaunchHandler);

// Alias for tier launch UI (same payload as select-tier on blueprints router)
router.post("/v1/onboarding/select-tier", selectBlueprintLaunchHandler);
router.post("/onboarding/select-tier", selectBlueprintLaunchHandler);

const configureTierBodySchema = z.object({
  blueprintId: z.string().uuid(),
  tier: tierSchema,
  selectedTier: tierSchema.optional(),
  mode: modeSchema.optional().default("individual"),
});

/** DOC 32 — persist tier/mode before activate (no launch). */
async function configureTierHandler(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = configureTierBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId and tier are required", 400);
      return;
    }
    const tier = parsed.data.selectedTier ?? parsed.data.tier;
    const mode = parsed.data.mode ?? "individual";
    const result = await BlueprintService.configureSelection(
      parsed.data.blueprintId,
      auth.userId,
      { tier, mode },
    );
    success(res, {
      blueprintId: parsed.data.blueprintId,
      tier,
      mode,
      configured: true,
      selection: result,
    });
  } catch (err) {
    handleError(req, res, err);
  }
}

router.post("/onboarding/configure-tier", configureTierHandler);
router.post("/v1/onboarding/configure-tier", configureTierHandler);
/** DOC 32 alias — tier selection only (use activate/launch separately). */
router.post("/onboarding/select-blueprint-tier", configureTierHandler);

export default router;
