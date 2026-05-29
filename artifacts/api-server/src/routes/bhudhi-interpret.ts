/**
 * BHUDHI_SYSTEM_SPECIFICATION.md — interpretation API endpoints.
 */
import { Router } from "express";
import { z } from "zod/v4";
import { db, blueprints, feedback } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import {
  analyzePatternsFromFeedbackRows,
  extractBehaviorFromFeedbackRows,
  interpretContext,
  interpretFeedback,
  interpretGoal,
  interpretPurpose,
} from "../engines/bhudhi/BhudhiInterpretationEngine.js";

const router = Router();

async function ownedBlueprint(blueprintId: string, userId: string) {
  const [bp] = await db
    .select({ id: blueprints.id, tier: blueprints.tier })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);
  return bp ?? null;
}

router.post("/bhudhi/interpret/goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        raw_goal: z.string().min(3),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "raw_goal required (min 3 chars)", 422);
      return;
    }
    const result = await interpretGoal(parsed.data.raw_goal, {
      userId: auth.userId,
      blueprintId: parsed.data.blueprintId,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/bhudhi/interpret/purpose", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        raw_purpose: z.string().min(3),
        goal_context: z.string().optional(),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "raw_purpose required", 422);
      return;
    }
    const result = await interpretPurpose(parsed.data.raw_purpose, {
      goalContext: parsed.data.goal_context,
      userId: auth.userId,
      blueprintId: parsed.data.blueprintId,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/bhudhi/interpret/context", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        timeframe: z.string().optional(),
        location: z.string().optional(),
        business_type: z.string().optional(),
        people: z.number().optional(),
        commitment: z.string().optional(),
        budget: z.union([z.string(), z.number()]).optional(),
        limits: z.array(z.string()).optional(),
      })
      .passthrough()
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid context payload", 422);
      return;
    }
    success(res, interpretContext(parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/bhudhi/interpret/feedback", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        task_id: z.string().optional(),
        completed: z.string(),
        score: z.number().min(0).max(10),
        reflection: z.string().optional(),
        proof: z.string().optional(),
        blocker: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid feedback payload", 422);
      return;
    }
    const result = await interpretFeedback(
      {
        task_id: parsed.data.task_id,
        completed: parsed.data.completed,
        score: parsed.data.score,
        reflection: parsed.data.reflection,
        proof: parsed.data.proof,
        blocker: parsed.data.blocker,
        confidence: parsed.data.confidence,
      },
      { userId: auth.userId, blueprintId: parsed.data.blueprintId },
    );
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/bhudhi/analyze/patterns", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bodySchema = z.object({
      blueprintId: z.string().uuid().optional(),
      feedback_history: z
        .array(
          z.object({
            completion_status: z.string().optional(),
            score: z.number().optional(),
            weighted_score: z.number().optional(),
            blocker_json: z.unknown().optional(),
            reflection: z.string().optional(),
          }),
        )
        .optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid patterns payload", 422);
      return;
    }

    let rows: (typeof feedback.$inferSelect)[] = [];

    if (parsed.data.feedback_history?.length) {
      rows = parsed.data.feedback_history.map((f, i) => ({
        id: `inline-${i}`,
        order_id: null,
        blueprint_id: parsed.data.blueprintId ?? "",
        user_id: auth.userId,
        completion_status: f.completion_status ?? "completed",
        score: f.score ?? null,
        weighted_score: f.weighted_score ?? f.score ?? 5,
        reflection: f.reflection ?? "",
        blocker_json: f.blocker_json ?? null,
        proof_json: null,
        friction_score: null,
        confidence_score: null,
        created_at: new Date(),
      })) as unknown as (typeof feedback.$inferSelect)[];
    } else if (parsed.data.blueprintId) {
      const bp = await ownedBlueprint(parsed.data.blueprintId, auth.userId);
      if (!bp) {
        failure(res, "NOT_FOUND", "Blueprint not found", 404);
        return;
      }
      rows = await db
        .select()
        .from(feedback)
        .where(
          and(eq(feedback.blueprint_id, parsed.data.blueprintId), eq(feedback.user_id, auth.userId)),
        )
        .orderBy(desc(feedback.created_at))
        .limit(10);
    } else {
      failure(res, "VALIDATION_ERROR", "Provide blueprintId or feedback_history", 422);
      return;
    }

    success(res, analyzePatternsFromFeedbackRows(rows));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/bhudhi/analyze/behavior", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    const bp = await ownedBlueprint(parsed.data.blueprintId, auth.userId);
    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const rows = await db
      .select()
      .from(feedback)
      .where(
        and(eq(feedback.blueprint_id, parsed.data.blueprintId), eq(feedback.user_id, auth.userId)),
      )
      .orderBy(desc(feedback.created_at))
      .limit(50);

    const tier = bp.tier ?? "starter";
    if (tier !== "ultimate" && tier !== "growth") {
      success(res, {
        available: false,
        message: "Behavior extraction is available on Growth and Ultimate tiers.",
        behavior: null,
      });
      return;
    }

    success(res, {
      available: true,
      behavior: extractBehaviorFromFeedbackRows(rows),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
