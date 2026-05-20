import { Router } from "express";
import { z } from "zod/v4";
import {
  db,
  blueprints,
  weeklyReviews,
  phaseCheckpoints,
  habits,
  habitCheckins,
  phases,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { FeedbackService } from "../services/FeedbackService.js";
import { UserService } from "../services/UserService.js";
import { routeBhudhiRequest } from "../bhudhi/TriggerRouter.js";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { answerInterrogation } from "../engines/feedback/InterrogationService.js";

const router = Router();
const blueprintEngine = new BlueprintEngine();

function currentUtcWeekBounds(d = new Date()): { start: Date; end: Date } {
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

const weeklyReviewSchema = z.object({
  blueprintId: z.string().uuid(),
  wins: z.string().min(5).max(2000),
  failures: z.string().max(2000).optional(),
  patterns: z.string().max(2000).optional(),
  nextFocus: z.string().min(5).max(1000),
  idempotencyKey: z.string().min(1),
});

const phaseCheckpointSchema = z.object({
  blueprintId: z.string().uuid(),
  phaseId: z.string().uuid(),
  outcomes: z.string().min(5).max(3000),
  evidence: z.string().min(5).max(3000),
  blockers: z.string().max(2000).optional(),
  risks: z.string().max(2000).optional(),
  readiness: z.enum(["ready", "not_ready", "needs_review"]),
  idempotencyKey: z.string().min(1),
});

const habitCheckinSchema = z.object({
  blueprintId: z.string().uuid(),
  habitId: z.string().uuid(),
  completed: z.boolean(),
  effortScore: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1),
});

// POST /api/feedback/weekly-review
router.post("/feedback/weekly-review", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = weeklyReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(
        and(
          eq(blueprints.id, input.blueprintId),
          eq(blueprints.user_id, auth.userId),
          eq(blueprints.active, true),
        ),
      )
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Active blueprint not found", 404);
      return;
    }

    const { start: weekStart, end: weekEnd } = currentUtcWeekBounds();

    const [review] = await db
      .insert(weeklyReviews)
      .values({
        blueprint_id: input.blueprintId,
        user_id: auth.userId,
        week_start: weekStart,
        week_end: weekEnd,
        wins: input.wins,
        failures: input.failures ?? null,
        patterns: input.patterns ?? null,
        next_focus: input.nextFocus,
      })
      .returning({ id: weeklyReviews.id });

    if (!review) {
      failure(res, "INTERNAL_ERROR", "Failed to create review", 500);
      return;
    }

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "weekly_review",
      entityId: review.id,
      userId: auth.userId,
      blueprintId: input.blueprintId,
      payload: {
        generation_mode: "post_feedback",
        generation_trigger: "weekly_review_submitted",
      },
      idempotencyKey: `weekly_review_task:${review.id}:${input.idempotencyKey}`,
    });

    success(res, { reviewId: review.id, submitted: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/feedback/phase-checkpoint
router.post("/feedback/phase-checkpoint", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = phaseCheckpointSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;

    const [phase] = await db
      .select({ id: phases.id })
      .from(phases)
      .where(and(eq(phases.id, input.phaseId), eq(phases.blueprint_id, input.blueprintId)))
      .limit(1);

    if (!phase) {
      failure(res, "NOT_FOUND", "Phase not found", 404);
      return;
    }

    const [checkpoint] = await db
      .insert(phaseCheckpoints)
      .values({
        blueprint_id: input.blueprintId,
        phase_id: input.phaseId,
        user_id: auth.userId,
        outcomes_achieved: input.outcomes,
        evidence_summary: input.evidence,
        bottlenecks: input.blockers ?? null,
        next_risks: input.risks ?? null,
        readiness: input.readiness,
        evaluated_at: new Date(),
      })
      .returning({ id: phaseCheckpoints.id });

    let phaseAdvanced = false;
    if (input.readiness === "ready") {
      try {
        const adv = await blueprintEngine.advanceBlueprintPosition(input.blueprintId, auth.userId);
        phaseAdvanced = adv.advanced;
      } catch {
        phaseAdvanced = false;
      }

      await writeEvent({
        eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
        entityType: "phase",
        entityId: input.phaseId,
        userId: auth.userId,
        blueprintId: input.blueprintId,
        payload: {
          generation_mode: "post_feedback",
          generation_trigger: "phase_completed",
        },
        idempotencyKey: `phase_task_gen:${input.phaseId}:${input.idempotencyKey}`,
      });
    }

    success(res, {
      checkpointId: checkpoint?.id,
      submitted: true,
      phaseAdvanced: input.readiness === "ready" ? phaseAdvanced : false,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/feedback/habit-checkin
router.post("/feedback/habit-checkin", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = habitCheckinSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;

    const [habit] = await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.id, input.habitId),
          eq(habits.user_id, auth.userId),
          eq(habits.blueprint_id, input.blueprintId),
        ),
      )
      .limit(1);

    if (!habit) {
      failure(res, "NOT_FOUND", "Habit not found", 404);
      return;
    }

    const [checkin] = await db
      .insert(habitCheckins)
      .values({
        habit_id: input.habitId,
        blueprint_id: input.blueprintId,
        user_id: auth.userId,
        completed: input.completed,
        effort_score: input.effortScore,
        note: input.notes ?? null,
      })
      .returning({ id: habitCheckins.id });

    if (input.completed) {
      await db
        .update(habits)
        .set({ streak_count: habit.streak_count + 1 })
        .where(eq(habits.id, input.habitId))
        .catch(() => null);
    } else {
      await db
        .update(habits)
        .set({ streak_count: 0 })
        .where(eq(habits.id, input.habitId))
        .catch(() => null);
    }

    success(res, { checkinId: checkin?.id, submitted: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/feedback/task — legacy path (demo user) for older clients
router.post("/feedback/task", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { orderId, completionRating, effortRating, notes, blockers } = req.body as {
      orderId: string;
      completionRating: number;
      effortRating?: number;
      notes?: string;
      blockers?: string[];
    };
    const feedback = await FeedbackService.submit(
      user.id,
      orderId,
      completionRating,
      effortRating ?? null,
      notes ?? null,
      blockers ?? [],
    );
    success(res, feedback, 201);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// POST /api/feedback/:id/interrogation — answer interrogation and resume primary loop
router.post("/feedback/:id/interrogation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const feedbackId = req.params.id!;
    const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
    const idempotencyKey =
      typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : `interrogation:${feedbackId}`;

    if (answer.length < 5) {
      failure(res, "VALIDATION_ERROR", "Answer must be at least 5 characters", 422);
      return;
    }

    const result = await answerInterrogation({
      feedbackId,
      userId: auth.userId,
      answer,
      idempotencyKey,
    });

    success(res, result);
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

// GET /api/feedback/:id/interrogation
router.get("/feedback/:id/interrogation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await routeBhudhiRequest({
      sourceEngine: "feedback",
      triggerType: "CLARIFICATION_PROMPT",
      userId: auth.userId,
      stateVersion: 0,
      idempotencyKey: `interrogation:${req.params.id}:${Date.now()}`,
      facts: {
        missingContext: "follow-up after task feedback",
        requiredField: "reflection",
        taskTitle: `Feedback ${req.params.id}`,
      },
    });
    const data = result.output?.data as { question?: string } | undefined;
    success(res, {
      feedbackId: req.params.id,
      questions: data?.question
        ? [data.question]
        : [
            "What specifically made this task hard?",
            "What would have made it easier?",
            "Is this blocker recurring?",
          ],
      context: null,
    });
  } catch (err) {
    handleRouteError(req, res, err);
  }
});

export default router;
