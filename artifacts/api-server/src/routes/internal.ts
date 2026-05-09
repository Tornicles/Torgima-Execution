import { Router } from "express";
import { z } from "zod/v4";
import { db, events, eventLogs, deadLetterEvents, systemHealthLogs, bhudhiLogs, blueprints } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { dispatchPendingEvents, getEventSystemHealth } from "../services/EventDispatcher.js";
import { runIntegrityChecks, processFindings } from "../services/SystemHealthService.js";
import { success, failure, handleError } from "../lib/utils.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { completeBlueprint } from "../engines/lifecycle/CompletionEngine.js";
import { pauseBlueprint } from "../engines/lifecycle/PauseEngine.js";
import { validateOutcome, resolveFlag } from "../engines/outcome/OutcomeValidationEngine.js";
import { evaluateReward } from "../engines/reward/RewardEngine.js";
import { evaluateIdentity } from "../engines/identity/IdentityEngine.js";
import { scanForInactivity } from "../engines/inactivity/InactivityDetectionEngine.js";
import { trigger } from "../bhudhi/BhudhiCore.js";
import { getContract } from "../bhudhi/PromptRegistry.js";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { logger } from "../lib/logger.js";
import { handleBounce, handleComplaint, sendNotification } from "../services/NotificationService.js";
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

// POST /api/internal/events/:id/replay
router.post("/internal/events/:id/replay", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;

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

// POST /api/internal/events/:id/cancel
router.post("/internal/events/:id/cancel", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;
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

// GET /api/internal/dead-letter
router.get("/internal/dead-letter", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const dlEvents = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.resolved, false))
      .orderBy(desc(deadLetterEvents.created_at))
      .limit(100);
    success(res, { events: dlEvents, count: dlEvents.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/dead-letter/:id/resolve
router.post("/internal/dead-letter/:id/resolve", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;
    const schema = z.object({
      action: z.enum(["skip", "mark_resolved"]),
      reason: z.string().min(1),
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "action and reason are required", 422);
      return;
    }

    const [dlEvent] = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.id, id))
      .limit(1);

    if (!dlEvent) {
      failure(res, "NOT_FOUND", "Dead letter event not found", 404);
      return;
    }

    await db
      .update(deadLetterEvents)
      .set({ resolved: true, reviewed: true, reviewed_at: new Date() })
      .where(eq(deadLetterEvents.id, id));

    success(res, { resolved: true, action: result.data.action, reason: result.data.reason });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/events/health
router.get("/internal/events/health", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const health = await getEventSystemHealth();
    success(res, health);
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
    const result = await trigger({
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
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const userCond = userId ? eq(bhudhiLogs.user_id, userId) : sql`true`;

    const [{ todayCount } = { todayCount: 0 }] = await db
      .select({ todayCount: sql<number>`count(*)::int` })
      .from(bhudhiLogs)
      .where(and(userCond, gte(bhudhiLogs.created_at, todayStart)));

    const [agg] = await db
      .select({
        inSum:  sql<number>`coalesce(sum(${bhudhiLogs.token_count_in}),0)::int`,
        outSum: sql<number>`coalesce(sum(${bhudhiLogs.token_count_out}),0)::int`,
      })
      .from(bhudhiLogs)
      .where(userCond);

    const recentLogs = await db
      .select({
        trigger_type:   bhudhiLogs.trigger_type,
        validation_status: bhudhiLogs.validation_status,
        latency_ms:     bhudhiLogs.latency_ms,
        created_at:     bhudhiLogs.created_at,
        output_json:    bhudhiLogs.output_json,
      })
      .from(bhudhiLogs)
      .where(userCond)
      .orderBy(desc(bhudhiLogs.created_at))
      .limit(20);

    const inSum  = agg?.inSum ?? 0;
    const outSum = agg?.outSum ?? 0;
    const totalCost = inSum * 0.000003 + outSum * 0.000015;

    success(res, {
      today:        todayCount ?? 0,
      totalTokens:  inSum + outSum,
      totalCost,
      recentLogs,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/notifications/bounce — provider webhooks (Resend-compatible shapes)
router.post("/internal/notifications/bounce", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");

    const body = req.body as Record<string, unknown>;
    logger.info({ type: body["type"] }, "[Webhook] Provider callback received");

    const type = body["type"];

    if (type === "bounce" || type === "email.bounced") {
      const data = (body["data"] ?? body["payload"]) as Record<string, unknown> | undefined;
      const bounce = (data?.["bounce"] ?? data?.["bounce_data"]) as Record<string, unknown> | undefined;
      const bounceTypeRaw = String(bounce?.["type"] ?? data?.["bounce_type"] ?? "").toLowerCase();
      const bounceType = bounceTypeRaw === "hard" ? "hard" : "soft";

      const to =
        data?.["to"] ??
        data?.["recipient"] ??
        data?.["email"] ??
        (Array.isArray(data?.["to"]) ? (data["to"] as string[])[0] : undefined);
      const email = typeof to === "string" ? to : undefined;

      if (email) await handleBounce(email, bounceType);
    }

    if (type === "complaint" || type === "email.complained") {
      const data = (body["data"] ?? body["payload"]) as Record<string, unknown> | undefined;
      const to =
        data?.["to"] ??
        data?.["recipient"] ??
        data?.["email"] ??
        (Array.isArray(data?.["to"]) ? (data["to"] as string[])[0] : undefined);
      const email = typeof to === "string" ? to : undefined;

      if (email) await handleComplaint(email);
    }

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

export default router;
