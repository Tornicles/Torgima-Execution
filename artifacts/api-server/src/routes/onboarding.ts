import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/onboarding/status
router.get("/onboarding/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const userRows = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
    const user = userRows[0] ?? null;
    const onboardingComplete = user?.onboarding_complete ?? false;

    const activeBlueprint = await BlueprintService.findActive(auth.userId);

    success(res, {
      completed: onboardingComplete,
      step: onboardingComplete ? "done" : "goal",
      blueprintId: activeBlueprint?.id ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/onboarding/goal
router.post("/onboarding/goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      rawGoal: z.string().min(1).max(2000).optional(),
      goal: z.string().min(1).max(2000).optional(),
      domain: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      success(res, { completed: false, step: "goal", blueprintId: null });
      return;
    }

    const goal = parsed.data.goal ?? parsed.data.rawGoal;
    if (!goal) {
      success(res, { completed: false, step: "goal", blueprintId: null });
      return;
    }

    const { blueprintId } = await BlueprintService.create(auth.userId, {
      goal,
      domainHint: parsed.data.domain ?? null,
    });
    await BlueprintService.activate(blueprintId, auth.userId);

    await db
      .update(users)
      .set({ onboarding_complete: true })
      .where(eq(users.id, auth.userId));

    success(res, {
      completed: true,
      step: "done",
      blueprintId,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
