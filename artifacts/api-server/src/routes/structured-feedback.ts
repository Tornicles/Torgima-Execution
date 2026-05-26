import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { StructuredFeedbackService } from "../services/StructuredFeedbackService.js";

const router = Router();

const startSchema = z.object({
  blueprintId: z.string().uuid(),
  triggerType: z
    .enum(["app_open", "task_finish", "leaving", "end_of_day", "recovery"])
    .optional(),
});

const sessionIdSchema = z.object({ sessionId: z.string().uuid() });

const sectionASchema = sessionIdSchema.extend({
  dailyReality: z.array(z.string()).optional(),
  realitySummary: z.string().max(4000).optional(),
});

const taskStateSchema = z.object({
  task_id: z.string().uuid(),
  state: z.enum([
    "Finished",
    "Partly Done",
    "Started",
    "Not Started",
    "Blocked",
    "Skipped",
  ]),
});

const sectionBSchema = sessionIdSchema.extend({
  taskStates: z.array(taskStateSchema).min(1),
});

const sectionCSchema = sessionIdSchema.extend({
  emotionalState: z.array(z.string()).min(1),
});

const sectionDSchema = sessionIdSchema.extend({
  frictionType: z.array(z.string()).min(1),
});

const sectionESchema = sessionIdSchema.extend({
  outputType: z.array(z.string()).min(1),
});

const sectionFSchema = sessionIdSchema.extend({
  reflectionSignal: z.enum(["yes_fine", "no_change", "help_understand"]),
});

const submitSchema = z.object({
  sessionId: z.string().uuid(),
  dailyReality: z.array(z.string()).optional(),
  realitySummary: z.string().max(4000).optional(),
  taskStates: z.array(taskStateSchema).min(1),
  emotionalState: z.array(z.string()).min(1),
  frictionType: z.array(z.string()).min(1),
  outputType: z.array(z.string()).min(1),
  reflectionSignal: z.enum(["yes_fine", "no_change", "help_understand"]).optional(),
});

router.post("/feedback/start", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    success(
      res,
      await StructuredFeedbackService.startSession(
        auth.userId,
        parsed.data.blueprintId,
        parsed.data.triggerType,
      ),
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/feedback/entry-check", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = typeof req.query.blueprintId === "string" ? req.query.blueprintId : "";
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    const route = await StructuredFeedbackService.resolveEntryRoute(blueprintId, auth.userId);
    success(res, { route });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/feedback/section-a", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = sectionASchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section A", 422);
      return;
    }
    success(res, await StructuredFeedbackService.patchSection(parsed.data.sessionId, auth.userId, "a", parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/feedback/section-b", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = sectionBSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section B", 422);
      return;
    }
    success(res, await StructuredFeedbackService.patchSection(parsed.data.sessionId, auth.userId, "b", parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/feedback/section-c", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = sectionCSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section C", 422);
      return;
    }
    success(res, await StructuredFeedbackService.patchSection(parsed.data.sessionId, auth.userId, "c", parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/feedback/section-d", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = sectionDSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section D", 422);
      return;
    }
    success(res, await StructuredFeedbackService.patchSection(parsed.data.sessionId, auth.userId, "d", parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/feedback/section-e", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = sectionESchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section E", 422);
      return;
    }
    success(res, await StructuredFeedbackService.patchSection(parsed.data.sessionId, auth.userId, "e", parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/feedback/section-f", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = sectionFSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section F", 422);
      return;
    }
    success(res, await StructuredFeedbackService.patchSection(parsed.data.sessionId, auth.userId, "f", parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/feedback/submit", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid submit payload", 422);
      return;
    }
    success(res, await StructuredFeedbackService.submitSession(auth.userId, parsed.data));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/signals/today", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = typeof req.query.blueprintId === "string" ? req.query.blueprintId : "";
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    success(res, await StructuredFeedbackService.getTodaySignals(blueprintId, auth.userId));
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
