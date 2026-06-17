import { Router } from "express";
import { z } from "zod/v4";
import { OrderService } from "../services/OrderService.js";
import { processFeedback } from "../engines/feedback/FeedbackProcessingEngine.js";
import { assertFeedbackPayloadWithinLimit } from "../lib/feedback-payload-limit.js";
import { requireAuth } from "../lib/auth.js";
import { authMiddleware, requireFullMode } from "../middleware/auth.js";
import type { AuthContext } from "../types/auth.js";
import { success, failure } from "../lib/utils.js";
import {
  handleRouteError,
  requireExplicitIdempotencyKey,
} from "../lib/route-helpers.js";
import { isTorgimaError } from "../lib/errors.js";
import { respondStaleState, resolveStaleCurrentVersion } from "../lib/state/StateVersionValidator.js";
import { drainEventsOnce } from "../services/EventLoopProcessor.js";
import { invalidateDashboardCache } from "../services/DashboardService.js";
import { buildTaskExecutionView } from "../lib/taskExecutionView.js";
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function buildOrderCommandContext(params: {
  domain: string | null | undefined;
  actionName: string | null | undefined;
  phaseName: string | null | undefined;
  projectName: string | null | undefined;
  orderTitle: string;
}): {
  where: string;
  how: string;
  whatItUnlocks: string;
  contributesTo: string;
} {
  const domain = params.domain?.toLowerCase() ?? "general";
  const platformMap: Record<string, string> = {
    genesis: "Your primary tools, notebook, calendar, or where you ship work",
    market: "Your customer-facing channels, CRM, or growth stack",
    delivery: "Your primary business tools, communication channels, or target platforms",
    continuity: "Your tracking, journaling, or maintenance systems",
    business: "Your primary business tools, communication channels, or target platforms",
    health: "Your tracking app, gym, or health monitoring system",
    financial: "Your financial accounts, spreadsheet, or investment platform",
    creative: "Your creative tools, portfolio, or publishing platform",
    personal_growth: "Your learning platform, journal, or habit tracker",
    technology: "Your development environment, GitHub, or deployment platform",
  };
  const where = platformMap[domain] ?? "The platform or environment most relevant to this action";
  const how =
    "Use the most direct path. If stuck for more than 10 minutes, document the blocker and submit feedback anyway.";
  return {
    where,
    how,
    whatItUnlocks: params.actionName ?? params.orderTitle,
    contributesTo: params.phaseName ?? params.projectName ?? "your current execution chain",
  };
}

const startBodySchema = z.object({
  expectedStateVersion: z.number().optional(),
});

const feedbackBodySchema = z.object({
  completionStatus: z.enum(["completed", "partial", "failed", "skipped"]),
  score: z.number().int().min(0).max(10),
  reflection: z.string().min(10).max(5000),
  difficultyFelt: z
    .enum(["very_easy", "easy", "moderate", "hard", "very_hard"])
    .optional(),
  proofJson: z.record(z.string(), z.unknown()).nullish(),
  blockerJson: z.record(z.string(), z.unknown()).nullish(),
  durationMinutes: z.number().optional(),
  frictionScore: z.number().min(1).max(5).optional(),
  confidenceScore: z.number().min(1).max(5).optional(),
  idempotencyKey: z.string().min(1),
  expectedStateVersion: z.number().optional(),
});

const finishBodySchema = z.object({
  outputSummary: z.string().max(2000).optional(),
  proof: z.record(z.string(), z.unknown()).optional(),
  expectedStateVersion: z.number().optional(),
});

const blockBodySchema = z.object({
  blockerType: z.enum([
    "skill_gap",
    "resource_gap",
    "dependency",
    "decision_gap",
    "external_wait",
    "other",
  ]),
  blockerDescription: z.string().min(5).max(1000),
  dependencyReference: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1),
  expectedStateVersion: z.number().optional(),
});

router.get("/orders/current", authMiddleware, requireFullMode, async (req, res) => {
  try {
    const auth = (req as typeof req & { auth: AuthContext }).auth;
    const task = await OrderService.getPrimaryDashboardTask(auth.userId);
    if (!task) {
      success(res, { order: null });
      return;
    }
    success(res, { order: task });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/orders/active", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const task = await OrderService.getPrimaryDashboardTask(auth.userId);
    if (!task) {
      success(res, { order: null });
      return;
    }
    success(res, {
      order: {
        id: task.id,
        stateVersion: task.stateVersion,
        blueprintId: task.blueprintId,
        title: task.title,
        instruction: task.instruction,
        expectedOutput: task.expectedOutput,
        definitionOfDone: task.definitionOfDone,
        whyItMatters: task.whyItMatters,
        difficulty: task.difficulty,
        taskType: task.taskType,
        timeEstimateMinutes: task.timeEstimateMinutes,
        proofRequired: task.proofRequired,
        proofType: task.proofType,
        proofDescription: task.proofDescription,
        status: task.status,
        domain: task.domain,
        priority: task.priority,
        knowledgeObjects: task.knowledgeObjects,
        priorityEngine: task.priorityEngine ?? null,
      },
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/orders/:id/decision-trace", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const payload = await OrderService.getDecisionTrace(req.params.id!, auth.userId);
    success(res, payload);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { order, joined, linkRows } = await OrderService.getOrderDetail(
      req.params.id!,
      auth.userId,
    );

    const commandContextBase = buildOrderCommandContext({
      domain: order.domain,
      actionName: joined.actionName,
      phaseName: joined.phaseName,
      projectName: joined.projectName,
      orderTitle: order.title,
    });
    const storedCtx = order.command_context as Record<string, unknown> | null | undefined;
    const commandContext =
      storedCtx && typeof storedCtx === "object" && Object.keys(storedCtx).length > 0
        ? { ...commandContextBase, ...storedCtx }
        : commandContextBase;

    const [bpRow] = await db
      .select({ state_version: blueprints.state_version })
      .from(blueprints)
      .where(eq(blueprints.id, order.blueprint_id))
      .limit(1);
    const stateVersion = bpRow?.state_version ?? 0;
    const taskExecution = buildTaskExecutionView({
      order,
      stateVersion,
      commandContextProof:
        typeof commandContext === "object" && commandContext && "proof" in commandContext
          ? String((commandContext as { proof?: string }).proof ?? "")
          : null,
    });

    success(res, {
      id: order.id,
      blueprintId: order.blueprint_id,
      stateVersion,
      taskExecution,
      title: order.title,
      instruction: order.instruction,
      expectedOutput: order.expected_output,
      definitionOfDone: order.definition_of_done,
      whyItMatters: order.why_it_matters,
      difficulty: order.difficulty,
      taskType: order.task_type,
      timeEstimateMinutes: order.time_estimate_minutes,
      proofRequired: order.proof_required,
      proofType: order.proof_type,
      proofDescription: order.proof_description,
      status: order.status,
      domain: order.domain,
      priority: order.priority,
      startedAt: order.started_at,
      finishedAt: order.finished_at,
      phaseName: joined.phaseName,
      projectName: joined.projectName,
      actionName: joined.actionName,
      commandContext,
      knowledgeObjects: linkRows.map((kl) => ({
        id: kl.kid,
        title: kl.title,
        content: kl.content,
        type: kl.type,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/start", async (req, res) => {
  let userId: string | undefined;
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    userId = auth.userId;
    const id = req.params.id!;
    const parsed = startBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const idempotencyKey = requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    await OrderService.startPendingOrder(id, auth.userId, {
      expectedStateVersion: parsed.data.expectedStateVersion,
      idempotencyKey,
    });
    invalidateDashboardCache(auth.userId);
    success(res, { started: true, orderId: id });
  } catch (e) {
    if (isTorgimaError(e) && e.code === "STALE_STATE") {
      const blueprintId = userId
        ? await OrderService.getBlueprintIdForOrder(req.params.id!, userId)
        : null;
      const currentStateVersion = await resolveStaleCurrentVersion(blueprintId);
      respondStaleState(res, currentStateVersion);
      return;
    }
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/feedback", async (req, res) => {
  let blueprintId: string | null = null;
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;
    assertFeedbackPayloadWithinLimit(req);
    const parsed = feedbackBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        parsed.error.issues.map((x) => [x.path.join("."), [x.message]]),
      );
      failure(res, "VALIDATION_ERROR", "Invalid input", 422, { fieldErrors });
      return;
    }
    const body = parsed.data;

    blueprintId = await OrderService.getBlueprintIdForOrder(id, auth.userId);
    if (!blueprintId) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    const result = await processFeedback({
      orderId: id,
      userId: auth.userId,
      blueprintId,
      completionStatus: body.completionStatus,
      score: body.score,
      reflection: body.reflection,
      difficultyFelt: body.difficultyFelt,
      proofJson: body.proofJson ?? undefined,
      blockerJson: body.blockerJson ?? undefined,
      durationMinutes: body.durationMinutes,
      frictionScore: body.frictionScore,
      confidenceScore: body.confidenceScore,
      idempotencyKey: body.idempotencyKey,
      expectedStateVersion: body.expectedStateVersion,
    });

    if (!result.requiresInterrogation) {
      await drainEventsOnce({ batchSize: 5, maxBatches: 6, maxRuntimeMs: 15_000 }).catch(() => null);
    }

    // Task feedback changes execution state — drop the cached dashboard so the
    // next poll recomputes immediately instead of serving a stale projection.
    invalidateDashboardCache(auth.userId);

    success(
      res,
      {
        feedbackId: result.feedbackId,
        requiresInterrogation: result.requiresInterrogation,
        interrogationQuestion: result.interrogationQuestion ?? null,
        nextStep: result.requiresInterrogation ? "answer_question" : "loop_running",
        message: result.requiresInterrogation
          ? "Please answer the question to continue."
          : "Feedback received. Next task is being prepared.",
        verdictStatus: result.verdictStatus,
        weightedScore: result.weightedScore,
        confidence: result.confidence,
      },
      200,
      { stateChanged: true },
    );
  } catch (e) {
    if (isTorgimaError(e) && e.code === "STALE_STATE") {
      const currentStateVersion = await resolveStaleCurrentVersion(blueprintId);
      respondStaleState(res, currentStateVersion);
      return;
    }
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/finish", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const parsed = finishBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const result = await OrderService.finishOrder(id, auth.userId, parsed.data);
    success(res, {
      status: result.status,
      orderId: id,
      requiresProof: result.requiresProof,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/block", async (req, res) => {
  let blueprintId: string | null = null;
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;
    const parsed = blockBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    blueprintId = await OrderService.getBlueprintIdForOrder(id, auth.userId);
    await OrderService.blockOrder(id, auth.userId, parsed.data);
    invalidateDashboardCache(auth.userId);
    success(res, { blocked: true, orderId: id });
  } catch (e) {
    if (isTorgimaError(e) && e.code === "STALE_STATE") {
      const currentStateVersion = await resolveStaleCurrentVersion(blueprintId);
      respondStaleState(res, currentStateVersion);
      return;
    }
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/unblock", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;
    await OrderService.unblockOrder(id, auth.userId);
    success(res, { unblocked: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/pause", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;
    await OrderService.pauseOrder(id, auth.userId);
    success(res, { paused: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/resume", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;
    await OrderService.resumeOrder(id, auth.userId);
    success(res, { resumed: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/orders/:id/reset", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;
    await OrderService.resetOrder(id, auth.userId);
    success(res, { reset: true, previousOrderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
