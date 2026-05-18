import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { routeTrigger } from "../bhudhi/TriggerRouter.js";
import { detectContradictions, hasHardContradiction } from "../engines/contradiction/ContradictionEngine.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { db, blueprints } from "@workspace/db";

const router = Router();

const goalBody = z.object({
  goal: z.string().min(3),
  purpose: z.string().optional(),
  timeframe: z.string().optional(),
  blueprintId: z.string().uuid().optional(),
});

router.post("/goals/create", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = goalBody.parse(req.body);
    const world = await getWorldModel(auth.userId);
    const routed = await routeTrigger({
      userId: auth.userId,
      blueprintId: body.blueprintId,
      payload: { rawGoal: body.goal, purpose: body.purpose, timeframe: body.timeframe, userInput: body.goal },
      worldStateVersion: world?.stateVersion ?? 0,
      currentCondition: "stability",
      triggerType: "USER_GOAL_TRIGGER",
      priority: "HIGH",
    });
    success(res, { structured: routed.bhudhiResponse?.output ?? null, routing: routed });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/goals/validate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = goalBody.parse(req.body);

    let blueprintId = body.blueprintId;
    if (!blueprintId) {
      const [bp] = await db
        .insert(blueprints)
        .values({
          user_id: auth.userId,
          goal: body.goal,
          purpose: body.purpose,
          status: "draft",
        })
        .returning({ id: blueprints.id });
      blueprintId = bp?.id;
    }

    if (!blueprintId) {
      failure(res, "INTERNAL_ERROR", "Could not create blueprint", 500);
      return;
    }

    const contradiction = await detectContradictions({
      userId: auth.userId,
      blueprintId,
      goal: body.goal,
      purpose: body.purpose,
      timeframe: body.timeframe,
    });

    const hardBlock = await hasHardContradiction(blueprintId);
    const world = await getWorldModel(auth.userId);
    const routed = await routeTrigger({
      userId: auth.userId,
      blueprintId,
      payload: { rawGoal: body.goal, purpose: body.purpose, timeframe: body.timeframe },
      worldStateVersion: world?.stateVersion ?? 0,
      currentCondition: "stability",
      triggerType: "USER_GOAL_TRIGGER",
      priority: "HIGH",
    });

    success(res, {
      contradiction,
      launchBlocked: hardBlock || contradiction.severity === "HARD",
      bhudhi: routed,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
