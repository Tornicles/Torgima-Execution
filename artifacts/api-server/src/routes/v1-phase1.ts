import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import {
  processFeedbackSubmission,
  type FeedbackSubmissionPayload,
} from "../engines/feedback/FeedbackProcessingEngine.js";
import { getCurrentInactivityForBlueprint } from "../engines/execution-loop/InactivityDetectionEngine.js";

const router = Router();

const feedbackSubmitSchema = z.object({
  orderId: z.string().uuid(),
  completion: z.enum(["COMPLETED", "PARTIAL", "FAILED", "BLOCKED", "SKIPPED"]),
  proofType: z.enum(["NONE", "TEXT", "FILE", "LINK", "CHECKLIST", "OUTPUT"]).optional(),
  proofText: z.string().max(10000).optional(),
  proofFileIds: z.array(z.string().uuid()).optional(),
  proofLinks: z.array(z.string().url()).optional(),
  checklistAnswers: z
    .array(z.object({ itemId: z.string(), completed: z.boolean() }))
    .optional(),
  durationMinutes: z.number().int().min(0).max(10080).optional(),
  effortScore: z.number().int().min(1).max(5).optional(),
  frictionScore: z.number().int().min(1).max(5).optional(),
  confidenceScore: z.number().int().min(1).max(5).optional(),
  blockerReason: z.string().max(2000).optional(),
  userNotes: z.string().max(5000).optional(),
  clientStateVersion: z.number().int().min(0),
  idempotencyKey: z.string().min(8).max(128),
});

// POST /api/v1/feedback/submit
router.post("/v1/feedback/submit", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = feedbackSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid feedback payload", 422);
      return;
    }

    const payload: FeedbackSubmissionPayload = {
      orderId: parsed.data.orderId,
      completion: parsed.data.completion,
      proofType: parsed.data.proofType,
      proofText: parsed.data.proofText,
      proofFileIds: parsed.data.proofFileIds,
      proofLinks: parsed.data.proofLinks,
      checklistAnswers: parsed.data.checklistAnswers,
      durationMinutes: parsed.data.durationMinutes,
      effortScore: parsed.data.effortScore as FeedbackSubmissionPayload["effortScore"],
      frictionScore: parsed.data.frictionScore as FeedbackSubmissionPayload["frictionScore"],
      confidenceScore: parsed.data.confidenceScore as FeedbackSubmissionPayload["confidenceScore"],
      blockerReason: parsed.data.blockerReason,
      userNotes: parsed.data.userNotes,
      clientStateVersion: parsed.data.clientStateVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    };

    const result = await processFeedbackSubmission(auth.userId, payload);
    success(res, result);
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    handleRouteError(req, res, e);
  }
});

// GET /api/v1/inactivity/current/:blueprintId
router.get("/v1/inactivity/current/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.blueprintId);
    if (!z.string().uuid().safeParse(blueprintId).success) {
      failure(res, "VALIDATION_ERROR", "Invalid blueprintId", 422);
      return;
    }
    const snapshot = await getCurrentInactivityForBlueprint(auth.userId, blueprintId);
    success(res, snapshot);
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    handleRouteError(req, res, e);
  }
});

export default router;
