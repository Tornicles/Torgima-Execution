import { Router } from "express";
import { z } from "zod/v4";
import { routeBhudhiRequest } from "../bhudhi/TriggerRouter.js";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { answerInterrogation } from "../engines/feedback/InterrogationService.js";
import { FeedbackAuxiliaryService } from "../services/FeedbackAuxiliaryService.js";

const router = Router();

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
    const result = await FeedbackAuxiliaryService.submitWeeklyReview(auth.userId, parsed.data);
    success(res, { reviewId: result.reviewId, submitted: true });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
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
    const result = await FeedbackAuxiliaryService.submitPhaseCheckpoint(auth.userId, input);
    success(res, {
      checkpointId: result.checkpointId,
      submitted: true,
      phaseAdvanced: input.readiness === "ready" ? result.phaseAdvanced : false,
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
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
    const result = await FeedbackAuxiliaryService.submitHabitCheckin(auth.userId, input);
    success(res, { checkinId: result.checkinId, submitted: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// Removed: POST /api/feedback/task — legacy demo route (no frontend callers).
// All order feedback goes through POST /api/orders/:id/feedback → processFeedback() + FEEDBACK_SUBMITTED.

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

    success(res, {
      ...result,
      nextStep: "loop_running",
      message: "Feedback received. Next task is being prepared.",
    });
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
