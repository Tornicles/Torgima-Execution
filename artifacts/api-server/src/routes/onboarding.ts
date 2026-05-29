import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { db, users, blueprints } from "@workspace/db";
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

// POST /api/onboarding/goal — minimal draft insert (no Bhudhi / Erector / events)
router.post("/onboarding/goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const body = (req.body ?? {}) as Record<string, unknown>;
    const goalRaw =
      typeof body.goal === "string"
        ? body.goal
        : typeof body.rawGoal === "string"
          ? body.rawGoal
          : "";
    const purposeRaw = typeof body.purpose === "string" ? body.purpose : "";

    const goal = goalRaw.trim() || "Untitled goal";
    const purpose = purposeRaw.trim() || null;

    const [inserted] = await db
      .insert(blueprints)
      .values({
        user_id: auth.userId,
        goal,
        purpose,
        raw_goal: goal,
        raw_goal_input: goal,
        raw_purpose: purpose,
        raw_purpose_input: purpose,
        status: "draft",
        active: false,
        mode: "individual",
        tier: "starter",
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
    console.error("[Onboarding] POST /onboarding/goal error:", message, err);
    failure(res, "INTERNAL_ERROR", message, 500);
  }
});

export default router;
