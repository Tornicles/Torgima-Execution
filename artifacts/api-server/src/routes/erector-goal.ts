/**
 * Doc §J — Blueprint goal/purpose refinement routes
 */
import { Router } from "express";
import { z } from "zod/v4";
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { refineGoal, refinePurpose } from "../engines/erector/ErectorRefinementEngine.js";
import { resolveArchetype } from "../engines/erector/ArchetypeResolutionEngine.js";

const router = Router();

async function ownedBlueprint(blueprintId: string, userId: string) {
  const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
  return bp?.user_id === userId ? bp : null;
}

router.post("/v1/blueprints/goal/refine-goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid(), rawGoal: z.string().min(5) }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid payload", 422);
      return;
    }
    const bp = await ownedBlueprint(parsed.data.blueprintId, auth.userId);
    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const { understanding, options, interpretation } = await refineGoal(parsed.data.rawGoal, {
      userId: auth.userId,
      blueprintId: parsed.data.blueprintId,
    });
    const withAngles = options.map((text, i) => ({
      text,
      angle:
        interpretation?.refinement_options[i]?.angle ??
        (["simple", "targeted", "business"] as const)[i] ??
        "simple",
      why: interpretation?.refinement_options[i]?.why,
      confidence: interpretation?.refinement_options[i]?.confidence,
    }));
    await db
      .update(blueprints)
      .set({ raw_goal_input: parsed.data.rawGoal, raw_goal: parsed.data.rawGoal, goal_options: withAngles })
      .where(eq(blueprints.id, parsed.data.blueprintId));
    success(res, {
      options: withAngles,
      understanding,
      goal_extraction: interpretation?.goal_extraction,
      gaps: interpretation?.gaps,
      ambiguity_level: interpretation?.ambiguity_level,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/blueprints/goal/confirm-goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        selectedGoalIndex: z.number().int().min(0).max(2),
        goalFinal: z.string().min(10),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid payload", 422);
      return;
    }
    if (!(await ownedBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    await db
      .update(blueprints)
      .set({
        selected_goal_index: parsed.data.selectedGoalIndex,
        goal_final: parsed.data.goalFinal,
        goal: parsed.data.goalFinal,
        refinement_status: "goal_refined",
      })
      .where(eq(blueprints.id, parsed.data.blueprintId));
    success(res, { goal_final: parsed.data.goalFinal, refinement_status: "goal_refined" });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/blueprints/goal/refine-purpose", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid(), rawPurpose: z.string().min(5) }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid payload", 422);
      return;
    }
    const bp = await ownedBlueprint(parsed.data.blueprintId, auth.userId);
    if (!bp?.goal_final) {
      failure(res, "VALIDATION_ERROR", "Confirm goal before refining purpose", 422);
      return;
    }
    const { understanding, options, interpretation } = await refinePurpose(parsed.data.rawPurpose, {
      userId: auth.userId,
      blueprintId: parsed.data.blueprintId,
      goalFinal: bp.goal_final,
    });
    const withAngles = options.map((text, i) => ({
      text,
      angle:
        interpretation?.refinement_options[i]?.angle ??
        (["problem", "transformation", "market"] as const)[i] ??
        "problem",
      why: interpretation?.refinement_options[i]?.why,
      confidence: interpretation?.refinement_options[i]?.confidence,
    }));
    await db
      .update(blueprints)
      .set({ raw_purpose_input: parsed.data.rawPurpose, purpose_options: withAngles })
      .where(eq(blueprints.id, parsed.data.blueprintId));
    success(res, {
      options: withAngles,
      understanding,
      purpose_extraction: interpretation?.purpose_extraction,
      clarity_scores: interpretation?.clarity_scores,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/blueprints/goal/confirm-purpose", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        selectedPurposeIndex: z.number().int().min(0).max(2),
        purposeFinal: z.string().min(10),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid payload", 422);
      return;
    }
    if (!(await ownedBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    await db
      .update(blueprints)
      .set({
        selected_purpose_index: parsed.data.selectedPurposeIndex,
        purpose_final: parsed.data.purposeFinal,
        purpose: parsed.data.purposeFinal,
        refinement_status: "complete",
      })
      .where(eq(blueprints.id, parsed.data.blueprintId));
    success(res, { purpose_final: parsed.data.purposeFinal, refinement_status: "complete" });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/v1/blueprints/goal/economic-type", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const country = String(req.query.country ?? "").trim();
    if (country.length < 2) {
      failure(res, "VALIDATION_ERROR", "country query required", 422);
      return;
    }
    const city = req.query.city ? String(req.query.city) : undefined;
    const archetype = await resolveArchetype(country, city);
    success(res, { country, economicType: archetype.primaryArchetype.name, archetype });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
