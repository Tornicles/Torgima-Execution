import { Router } from "express";
import { z } from "zod";
import { db, blueprints, milestones, outcomeValidations } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { getCurrentIdentityState } from "../engines/identity/IdentityEngine.js";
import { getPendingRewards, markRewardsDelivered } from "../engines/reward/RewardEngine.js";
import {
  getOpenFlags,
  validateOutcome,
} from "../engines/outcome/OutcomeValidationEngine.js";

const router = Router();

router.get("/identity/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [blueprint] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    if (!blueprint) {
      success(res, { identityState: null, milestones: [] });
      return;
    }

    const state = await getCurrentIdentityState(auth.userId, blueprint.id);
    const ms = await db
      .select()
      .from(milestones)
      .where(
        and(eq(milestones.user_id, auth.userId), eq(milestones.blueprint_id, blueprint.id)),
      )
      .orderBy(desc(milestones.created_at))
      .limit(5);

    success(res, {
      identityState: state
        ? {
            stage:               state.stage,
            reinforcementCount: state.reinforcement_count,
            transformationScore: state.transformation_score,
            updatedAt:           state.updated_at,
          }
        : null,
      milestones: ms.map(m => ({
        id:          m.id,
        type:        m.type,
        title:       m.title,
        description: m.description,
        seenByUser:  m.seen_by_user,
        createdAt:   m.created_at,
      })),
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get identity", 500);
  }
});

router.get("/rewards/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [blueprint] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    const rewards = await getPendingRewards(auth.userId, blueprint?.id);

    if (rewards.length > 0) {
      await markRewardsDelivered(rewards.map(r => r.id));
    }

    success(res, {
      rewards: rewards.map(r => ({
        id:          r.id,
        rewardType:  r.reward_type,
        title:       r.title,
        description: r.description,
        createdAt:   r.created_at,
      })),
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get rewards", 500);
  }
});

router.get("/outcomes/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [blueprint] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    if (!blueprint) {
      success(res, { validations: [], openFlags: [] });
      return;
    }

    const [validations, openFlags] = await Promise.all([
      db
        .select()
        .from(outcomeValidations)
        .where(eq(outcomeValidations.blueprint_id, blueprint.id))
        .orderBy(desc(outcomeValidations.created_at))
        .limit(5),
      getOpenFlags(blueprint.id),
    ]);

    success(res, {
      validations: validations.map(v => {
        let extra: Record<string, unknown> = {};
        try {
          if (v.notes) extra = JSON.parse(v.notes) as Record<string, unknown>;
        } catch {
          extra = {};
        }
        return {
          id:                   v.id,
          status:               v.verdict,
          evidenceScore:        v.alignment_score,
          outcomeMovementScore:
            (extra["outcome_movement_score"] as number | undefined) ?? v.outcomes_verified,
          confidence:           extra["confidence"],
          createdAt:            v.created_at,
        };
      }),
      openFlags: openFlags.map(f => ({
        id:        f.id,
        flagType:  f.detection_type,
        severity:  f.severity,
        status:    f.resolved ? "RESOLVED" : "OPEN",
        createdAt: f.created_at,
      })),
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get outcomes", 500);
  }
});

const evidenceSchema = z.object({
  evidenceText: z.string().min(10).max(2000),
  targetId:     z.string().uuid().optional(),
  claimText:    z.string().max(500).optional(),
});

router.post("/outcomes/:id/evidence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const input = evidenceSchema.parse(req.body);
    const sourceId = req.params["id"];
    if (!sourceId) {
      failure(res, "VALIDATION_ERROR", "Missing id", 400);
      return;
    }

    const [blueprint] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    if (!blueprint) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }

    const result = await validateOutcome({
      userId:       auth.userId,
      blueprintId:  blueprint.id,
      targetId:     input.targetId,
      claimText:    input.claimText,
      evidenceText: input.evidenceText,
      sourceType:   "USER_CLAIM",
      sourceId,
    });

    success(res, result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 400);
      return;
    }
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Outcome validation failed", 500);
  }
});

export default router;
