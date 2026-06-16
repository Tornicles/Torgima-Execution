import { Router } from "express";
import { z } from "zod/v4";
import { db, events, eventLogs, deadLetterEvents, systemHealthLogs, bhudhiLogs, blueprints } from "@workspace/db";
import { BudgetController } from "../lib/bhudhi/BudgetController.js";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { dispatchPendingEvents, getEventSystemHealth } from "../services/EventDispatcher.js";
import { getWorkerMonitoringHealth } from "../workers/WorkerDispatcher.js";
import { replayDeadLetteredEvent } from "../workers/DeadLetterHandler.js";
import { deadLetterQueue } from "../services/DeadLetterQueue.js";
import { systemHealthMonitor } from "../engines/state/SystemHealthMonitor.js";
import { collectProductionMetrics } from "../services/MonitoringMetricsService.js";
import { runIntegrityChecks, processFindings } from "../services/SystemHealthService.js";
import { success, failure, handleError } from "../lib/utils.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { completeBlueprint } from "../engines/lifecycle/CompletionEngine.js";
import { pauseBlueprint } from "../engines/lifecycle/PauseEngine.js";
import { validateOutcome, resolveFlag } from "../engines/outcome/OutcomeValidationEngine.js";
import { evaluateReward } from "../engines/reward/RewardEngine.js";
import { evaluateIdentity } from "../engines/identity/IdentityEngine.js";
import { scanForInactivity } from "../engines/inactivity/InactivityDetectionEngine.js";
import { routeBhudhiRequest } from "../bhudhi/TriggerRouter.js";
import { processFeedbackSubmission } from "../engines/feedback/submitFeedbackPhase1.js";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { scanPatterns } from "../engines/pattern/PatternLearningEngine.js";
import { classifyFailure } from "../engines/failure/FailureClassificationEngine.js";
import { detectFrictionForFeedback } from "../engines/friction/FrictionDetectionEngine.js";
import { selectHighestValueTask } from "../engines/priority/PriorityEngine.js";
import { checkExecutability } from "../engines/dependency/DependencyEngine.js";
import { OrchestrationHealthMonitor } from "../engines/orchestration/OrchestrationHealthMonitor.js";
import { acquireWorkflowLocks } from "../engines/orchestration/OrchestrationService.js";
import { getContract } from "../bhudhi/PromptRegistry.js";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { logger } from "../lib/logger.js";
import { applyEmailWebhookEvent, sendNotification } from "../services/NotificationService.js";
import { NOTIFICATION_TYPES, type NotificationType } from "../constants/notifications.js";
const router = Router();

// POST /api/internal/events/dispatch
router.post("/internal/events/dispatch", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const dispatched = await dispatchPendingEvents();
    success(res, { dispatched });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/events/:id/replay — Phase 2: /api/v1/internal/events/:id/replay
router.post(["/internal/events/:id/replay", "/v1/internal/events/:id/replay"], async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const id = String(req.params.id);

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!event) {
      failure(res, "NOT_FOUND", "Event not found", 404);
      return;
    }

    if (event.status !== "dead_lettered" && event.status !== "retry_pending") {
      failure(res, "VALIDATION_ERROR", "Only dead_lettered or retry_pending events can be replayed", 422);
      return;
    }

    // Reset to pending for reprocessing
    await db
      .update(events)
      .set({ status: "pending", retry_count: 0 })
      .where(eq(events.id, id));

    await db.insert(eventLogs).values({
      event_id: id,
      worker: "repair_route",
      result: "success",
      error_message: "Replayed via internal repair route",
      processed_at: new Date(),
    });

    success(res, { replayed: true, eventId: id });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/events/:id/cancel — Phase 2: /api/v1/internal/events/:id/cancel
router.post(["/internal/events/:id/cancel", "/v1/internal/events/:id/cancel"], async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const id = String(req.params.id);
    const schema = z.object({ reason: z.string().min(1) });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "reason is required", 422);
      return;
    }

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      failure(res, "NOT_FOUND", "Event not found", 404);
      return;
    }

    await db.update(events).set({ status: "cancelled" }).where(eq(events.id, id));

    await db.insert(eventLogs).values({
      event_id: id,
      worker: "repair_route",
      result: "failed",
      error_message: `Cancelled: ${result.data.reason}`,
      processed_at: new Date(),
    });

    success(res, { cancelled: true, eventId: id, reason: result.data.reason });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/dead-letter — Phase 2 alias: /api/v1/internal/events/dead-letter
router.get(["/internal/dead-letter", "/v1/internal/events/dead-letter"], async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const events = await deadLetterQueue.listUnresolved(100);
    success(res, { events, count: events.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/dead-letter/:id/resolve — DOC16 + Phase 2 aliases
router.post(
  ["/internal/dead-letter/:id/resolve", "/v1/internal/events/dead-letter/:id/resolve"],
  async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const dlId = String(req.params.id);
    const schema = z.object({
      action: z.enum([
        "skip",
        "mark_resolved",
        "replay",
        "rebuild",
        "escalate",
        "manual_repair",
      ]),
      reason: z.string().min(1),
      resolution: z.enum(["replay", "skip", "manual_repair"]).optional(),
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "action and reason are required", 422);
      return;
    }

    const action =
      result.data.resolution === "manual_repair"
        ? "manual_repair"
        : result.data.resolution === "replay"
          ? "replay"
          : result.data.resolution === "skip"
            ? "skip"
            : result.data.action;

    const [dlEvent] = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.id, dlId))
      .limit(1);

    if (!dlEvent) {
      failure(res, "NOT_FOUND", "Dead letter event not found", 404);
      return;
    }

    if (action === "replay" && dlEvent.original_event_id) {
      await replayDeadLetteredEvent(dlEvent.original_event_id);
      await dispatchPendingEvents();
    }

    const resolutionStatus =
      action === "replay" ? "REPLAYING"
      : action === "rebuild" || action === "manual_repair" ? "REBUILT"
      : action === "escalate" ? "OPEN"
      : "RESOLVED";

    await db
      .update(deadLetterEvents)
      .set({
        resolved: action !== "escalate",
        reviewed: true,
        reviewed_at: new Date(),
        resolved_at: new Date(),
        resolution_status: resolutionStatus,
        failure_reason:
          action === "manual_repair"
            ? `${dlEvent.failure_reason} | manual_repair: ${result.data.reason}`
            : dlEvent.failure_reason,
      })
      .where(eq(deadLetterEvents.id, dlId));

    success(res, { resolved: true, action, reason: result.data.reason });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/metrics — Prompt 8 monitoring
router.get("/internal/metrics", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const metrics = await collectProductionMetrics();
    success(res, metrics);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/events/health — Phase 2: /api/v1/internal/events/health
router.get(["/internal/events/health", "/v1/internal/events/health"], async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const [health, workerHealth] = await Promise.all([
      getEventSystemHealth(),
      getWorkerMonitoringHealth(),
    ]);
    success(res, { ...health, ...workerHealth });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/internal/health/system — Phase 2 SystemHealthMonitor
router.get(["/internal/health/system", "/v1/internal/health/system"], async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const snapshot = await systemHealthMonitor.getSnapshot();
    success(res, snapshot);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/health/check — run scoped health sweep on demand.
// Spec: Prompt 6 §STEP 7, DOC_17 §20.
router.post("/internal/health/check", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const findings = await runIntegrityChecks();
    await processFindings(findings);
    success(res, {
      findingsCount: findings.length,
      findings: findings.map((f) => ({
        issueCode: f.issueCode,
        severity: f.severity,
        area: f.area,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/health/logs
router.get("/internal/health/logs", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const logs = await db
      .select()
      .from(systemHealthLogs)
      .where(eq(systemHealthLogs.status, "degraded"))
      .orderBy(desc(systemHealthLogs.created_at))
      .limit(100);
    success(res, { logs, count: logs.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/bhudhi/trigger
router.post("/internal/bhudhi/trigger", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const schema = z.object({
      sourceEngine:   z.string(),
      triggerType:    z.string(),
      userId:         z.string().uuid(),
      blueprintId:    z.string().uuid().optional(),
      stateVersion:   z.number(),
      userInput:      z.string().optional(),
      facts:          z.record(z.string(), z.unknown()).optional(),
      idempotencyKey: z.string(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 400);
      return;
    }
    const triggerType = parsed.data.triggerType as BhudhiTriggerType;
    if (!getContract(triggerType)) {
      failure(res, "VALIDATION_ERROR", "Unknown triggerType", 400);
      return;
    }
    const result = await routeBhudhiRequest({
      sourceEngine:   parsed.data.sourceEngine,
      triggerType,
      userId:         parsed.data.userId,
      blueprintId:    parsed.data.blueprintId,
      stateVersion:   parsed.data.stateVersion,
      userInput:      parsed.data.userInput,
      facts:          parsed.data.facts ?? {},
      idempotencyKey: parsed.data.idempotencyKey,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/bhudhi/usage?userId=
router.get("/internal/bhudhi/usage", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const report = await BudgetController.getDailyUsageReport();
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;

    if (userId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [{ todayCount } = { todayCount: 0 }] = await db
        .select({ todayCount: sql<number>`count(*)::int` })
        .from(bhudhiLogs)
        .where(and(eq(bhudhiLogs.user_id, userId), gte(bhudhiLogs.created_at, todayStart)));

      success(res, { ...report, user_calls_today: todayCount ?? 0, userId });
      return;
    }

    success(res, report);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/notifications/bounce — operator-only; prefer public POST /api/webhooks/notifications/bounce in production.
router.post("/internal/notifications/bounce", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");

    const body = req.body as Record<string, unknown>;
    logger.info({ type: body["type"] }, "[Webhook] Provider callback received (internal)");

    await applyEmailWebhookEvent(body);

    success(res, { received: true });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[Webhook] Provider callback failed",
    );
    handleError(req, res, err);
  }
});

const internalSendSchema = z.object({
  userId: z.string().uuid(),
  notificationType: z.string(),
  blueprintId: z.string().uuid().optional(),
  sourceEventId: z.string().optional(),
  contextData: z.record(z.string(), z.unknown()).optional(),
  escalation: z.boolean().optional(),
});

// POST /api/internal/notifications/send
router.post("/internal/notifications/send", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const parsed = internalSendSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 400);
      return;
    }

    const nt = parsed.data.notificationType;
    if (!(Object.values(NOTIFICATION_TYPES) as string[]).includes(nt)) {
      failure(res, "VALIDATION_ERROR", "Unknown notification type", 400);
      return;
    }
    if (nt === NOTIFICATION_TYPES.MAGIC_LINK_AUTH) {
      failure(res, "VALIDATION_ERROR", "Auth notifications are handled by AuthService, not this route", 400);
      return;
    }

    const result = await sendNotification({
      userId: parsed.data.userId,
      notificationType: nt as NotificationType,
      blueprintId: parsed.data.blueprintId,
      sourceEventId: parsed.data.sourceEventId,
      contextData: parsed.data.contextData,
      escalation: parsed.data.escalation,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("notification_send_exhausted")) {
        return { sent: false, suppressed: false, suppressionReason: "exhausted" as const };
      }
      throw err;
    });

    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// ── Prompt 14 — internal engine triggers ───────────────────────────────────

const signalRecalcSchema = z.object({
  blueprintId: z.string().uuid(),
  triggerEventId: z.string().uuid().optional(),
});

router.post("/internal/signals/recalculate", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = signalRecalcSchema.parse(req.body);

    const eventId = await writeEvent({
      eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
      entityType: "blueprint",
      entityId: input.blueprintId,
      blueprintId: input.blueprintId,
      payload: {
        trigger: "internal_manual",
        ...(input.triggerEventId ? { trigger_event_id: input.triggerEventId } : {}),
      },
      idempotencyKey: `signal_recalc_manual:${input.blueprintId}:${Date.now()}`,
    });

    success(res, { queued: true, eventId });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/internal/blueprints/:id/complete", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;

    const [blueprint] = await db
      .select({ user_id: blueprints.user_id })
      .from(blueprints)
      .where(eq(blueprints.id, id))
      .limit(1);

    if (!blueprint) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const result = await completeBlueprint({ blueprintId: id, userId: blueprint.user_id });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const forcePauseSchema = z.object({ reason: z.string().optional() });

router.post("/internal/blueprints/:id/force-pause", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;
    const input = forcePauseSchema.parse(req.body ?? {});

    const [blueprint] = await db
      .select({ user_id: blueprints.user_id })
      .from(blueprints)
      .where(eq(blueprints.id, id))
      .limit(1);

    if (!blueprint) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    await pauseBlueprint({
      blueprintId: id,
      userId: blueprint.user_id,
      reason: input.reason ?? "System forced pause",
      skipGuards: true,
    });
    success(res, { paused: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

const validateOutcomeSchema = z.object({
  userId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  targetId: z.string().uuid().optional(),
  claimText: z.string().optional(),
  evidenceText: z.string().optional(),
  sourceType: z.string(),
  sourceId: z.string(),
});

router.post("/internal/outcomes/validate", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = validateOutcomeSchema.parse(req.body);
    const result = await validateOutcome(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const resolveFalseProgressSchema = z.object({ resolutionNote: z.string().min(5) });

router.post("/internal/false-progress/:id/resolve", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = resolveFalseProgressSchema.parse(req.body);
    await resolveFlag(req.params.id!, input.resolutionNote);
    success(res, { resolved: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

const evaluateRewardSchema = z.object({
  userId: z.string().uuid(),
  blueprintId: z.string().uuid().optional(),
  sourceType: z.enum([
    "FEEDBACK",
    "SIGNAL",
    "IDENTITY",
    "MILESTONE",
    "OUTCOME",
    "INACTIVITY",
    "CAPABILITY",
  ]),
  sourceId: z.string(),
  stateVersion: z.number(),
  idempotencyKey: z.string().min(1),
});

router.post("/internal/rewards/evaluate", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = evaluateRewardSchema.parse(req.body);
    const result = await evaluateReward(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const evaluateIdentitySchema = z.object({
  userId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  reason: z.string().optional(),
  windowDays: z.number().optional(),
});

router.post("/internal/identity/evaluate", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = evaluateIdentitySchema.parse(req.body);
    const result = await evaluateIdentity(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/internal/inactivity/scan", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const result = await scanForInactivity();
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const feedbackProcessSchema = z.object({
  userId: z.string().uuid(),
  orderId: z.string().uuid(),
  completion: z.enum(["COMPLETED", "PARTIAL", "FAILED", "BLOCKED", "SKIPPED"]),
  clientStateVersion: z.number().int(),
  idempotencyKey: z.string().min(8),
  proofType: z.enum(["NONE", "TEXT", "FILE", "LINK", "CHECKLIST", "OUTPUT"]).optional(),
  proofText: z.string().optional(),
  userNotes: z.string().optional(),
});

router.post("/internal/feedback/process", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = feedbackProcessSchema.parse(req.body);
    const result = await processFeedbackSubmission(input.userId, {
      orderId: input.orderId,
      completion: input.completion,
      clientStateVersion: input.clientStateVersion,
      idempotencyKey: input.idempotencyKey,
      proofType: input.proofType,
      proofText: input.proofText,
      userNotes: input.userNotes,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const guaranteeSchema = z.object({
  userId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  generationMode: z.string().optional(),
  generationTrigger: z.string().optional(),
});

router.post("/internal/execution/guarantee", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = guaranteeSchema.parse(req.body);
    const result = await guaranteeTask(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const patternScanSchema = z.object({
  userId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  windowDays: z.number().int().min(1).max(90).optional(),
});

router.post("/internal/patterns/scan", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = patternScanSchema.parse(req.body);
    const result = await scanPatterns(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const classifyFailureSchema = z.object({
  userId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  orderId: z.string().uuid(),
  feedbackId: z.string().uuid(),
});

router.post("/internal/failures/classify", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = classifyFailureSchema.parse(req.body);
    const result = await classifyFailure(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const frictionEvaluateSchema = z.object({
  userId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  feedbackId: z.string().uuid(),
});

router.post("/internal/friction/evaluate", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = frictionEvaluateSchema.parse(req.body);
    const result = await detectFrictionForFeedback(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const priorityEvaluateSchema = z.object({
  blueprintId: z.string().uuid(),
  userId: z.string().uuid(),
  condition: z.string().optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        task_type: z.string(),
        title: z.string().optional(),
        dependency_blocked: z.boolean().optional(),
      }),
    )
    .min(1),
});

router.post("/internal/priority/evaluate", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = priorityEvaluateSchema.parse(req.body);
    const result = await selectHighestValueTask(input.candidates, {
      blueprintId: input.blueprintId,
      userId: input.userId,
      condition: input.condition ?? "stable",
      allowedActions: [],
      falseProgressActive: false,
      capability: null,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const dependencyMapSchema = z.object({
  blueprintId: z.string().uuid(),
  userId: z.string().uuid(),
  orderId: z.string().uuid(),
});

router.post("/internal/dependencies/map", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = dependencyMapSchema.parse(req.body);
    const result = await checkExecutability(input);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

const orchestrationStartSchema = z.object({
  blueprintId: z.string().uuid(),
  userId: z.string().uuid(),
  workflowName: z
    .enum(["FEEDBACK_COMPLETION", "INACTIVITY_DETECTION", "FAILURE_CORRECTION"])
    .default("FEEDBACK_COMPLETION"),
});

router.post("/internal/orchestration/start", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const input = orchestrationStartSchema.parse(req.body);
    const locks = await acquireWorkflowLocks({
      entityId: input.blueprintId,
      blueprintId: input.blueprintId,
      userId: input.userId,
      workflowName: input.workflowName,
    });
    success(res, { started: true, workflow: input.workflowName, locks });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/internal/bhudhi/usage/summary", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const report = await BudgetController.getDailyUsageReport();
    success(res, report);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/auth/validate — DOC 30 internal auth probe (workers only)
router.post("/internal/auth/validate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "INTERNAL_SERVICE");
    success(res, {
      valid: true,
      isInternal: auth.isInternal,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
