/**
 * DOC 11 — Inactivity Detection Engine (execution loop).
 * Called by InactivityWorker / scanAll; classifies silence, selects recovery paths.
 */

import {
  db,
  blueprints,
  feedback,
  orders,
  inactivityRecords,
  enforcementPackages,
  signalSnapshots,
  falseProgressFlags,
} from "@workspace/db";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { BlueprintStatus, OrderStatus } from "@workspace/state-machine";
import { logger } from "../../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../../services/EventService.js";
import { EventTypes } from "../../../types/eventContracts.js";
import {
  classifyInactivityReason,
  type InactivityEvidenceContext,
  type Doc11InactivityType,
} from "./InactivityClassifier.js";
import {
  selectRecoveryPath,
  type Doc11InactivitySeverity,
} from "./RecoveryPathSelector.js";

export type { Doc11InactivityType, Doc11InactivitySeverity };
export { classifyInactivityReason } from "./InactivityClassifier.js";
export { selectRecoveryPath } from "./RecoveryPathSelector.js";

const OPEN_ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.ACTIVE,
  OrderStatus.NEEDS_FEEDBACK,
  OrderStatus.BLOCKED,
  OrderStatus.NEEDS_PROOF,
] as const;

export function severityFromHoursInactive(hoursInactive: number): Doc11InactivitySeverity | null {
  if (hoursInactive < 24) return null;
  if (hoursInactive < 72) return "MODERATE";
  if (hoursInactive < 144) return "HIGH";
  return "CRITICAL";
}

export function doc11SeverityLabel(severity: Doc11InactivitySeverity): string {
  return severity;
}

async function getLastFeedbackTimestamp(userId: string, blueprintId: string): Promise<Date | null> {
  const [row] = await db
    .select({ created_at: feedback.created_at })
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), eq(feedback.blueprint_id, blueprintId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);
  return row?.created_at ?? null;
}

async function getLastOrderActivityTimestamp(userId: string, blueprintId: string): Promise<Date | null> {
  const [row] = await db
    .select({ ts: orders.started_at, updated: orders.updated_at })
    .from(orders)
    .where(and(eq(orders.user_id, userId), eq(orders.blueprint_id, blueprintId)))
    .orderBy(desc(orders.updated_at))
    .limit(1);
  return row?.ts ?? row?.updated ?? null;
}

export async function getOpenInactivityRecord(userId: string, blueprintId: string) {
  const [row] = await db
    .select()
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.user_id, userId),
        eq(inactivityRecords.blueprint_id, blueprintId),
        eq(inactivityRecords.resolved, false),
      ),
    )
    .orderBy(desc(inactivityRecords.created_at))
    .limit(1);
  return row ?? null;
}

async function buildEvidenceContext(
  userId: string,
  blueprintId: string,
): Promise<InactivityEvidenceContext> {
  const [lastOrder] = await db
    .select({
      difficulty: orders.difficulty,
    })
    .from(orders)
    .where(and(eq(orders.user_id, userId), eq(orders.blueprint_id, blueprintId)))
    .orderBy(desc(orders.updated_at))
    .limit(1);

  const [lastFb] = await db
    .select({
      score: feedback.score,
      completion_status: feedback.completion_status,
      blocker_json: feedback.blocker_json,
      friction_score: feedback.friction_score,
      created_at: feedback.created_at,
    })
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), eq(feedback.blueprint_id, blueprintId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentFeedback = await db
    .select({ created_at: feedback.created_at, completion_status: feedback.completion_status })
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, userId),
        eq(feedback.blueprint_id, blueprintId),
        gte(feedback.created_at, fourteenDaysAgo),
      ),
    );

  const expectedActiveDays = 14;
  const activeDays = new Set(
    recentFeedback.map((f) => f.created_at.toISOString().slice(0, 10)),
  ).size;
  const consistencyRate = activeDays / expectedActiveDays;

  const snapshots = await db
    .select({
      completion_rate: signalSnapshots.completion_rate,
      momentum: signalSnapshots.momentum,
      created_at: signalSnapshots.created_at,
    })
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.user_id, userId)))
    .orderBy(desc(signalSnapshots.created_at))
    .limit(2);

  let signalTrend: InactivityEvidenceContext["signalTrend"] = null;
  if (snapshots.length >= 2) {
    const [latest, prior] = snapshots;
    if ((latest.momentum ?? 0) < (prior.momentum ?? 0)) signalTrend = "declining";
    else if ((latest.momentum ?? 0) > (prior.momentum ?? 0)) signalTrend = "rising";
    else signalTrend = "stable";
  }

  let completionRateTrend: InactivityEvidenceContext["completionRateTrend"] = null;
  if (snapshots.length >= 2) {
    const [latest, prior] = snapshots;
    if ((latest.completion_rate ?? 0) < (prior.completion_rate ?? 0) - 0.05) {
      completionRateTrend = "dropping";
    }
  }

  const fpOpen = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    )
    .limit(1);

  const blocker = (lastFb?.blocker_json ?? {}) as Record<string, unknown>;

  return {
    lastOrderDifficulty: lastOrder?.difficulty ?? null,
    lastFeedbackScore: lastFb?.score ?? null,
    lastCompletionStatus: lastFb?.completion_status ?? null,
    lastBlockerCategory:
      typeof blocker.blocker_category === "string" ? blocker.blocker_category : null,
    hadRecentFriction: (lastFb?.friction_score ?? 0) >= 4 || lastFb?.completion_status === "blocked",
    consistencyRate,
    signalTrend,
    completionRateTrend,
    openFalseProgressFlags: fpOpen.length > 0 ? 1 : 0,
    lowOutcomeMovement: (snapshots[0]?.completion_rate ?? 1) < 0.25,
  };
}

async function applyCriticalEnforcement(blueprintId: string, taskLimitMax = 1): Promise<void> {
  await db
    .update(enforcementPackages)
    .set({
      task_limits: { min: 1, max: taskLimitMax },
    })
    .where(
      and(
        eq(enforcementPackages.blueprint_id, blueprintId),
        eq(enforcementPackages.is_current, true),
      ),
    )
    .catch(() => null);
}

async function emitRecoveryEvents(params: {
  userId: string;
  blueprintId: string;
  recordId: string;
  severity: Doc11InactivitySeverity;
  hoursInactive: number;
  inactivityType: Doc11InactivityType;
}): Promise<void> {
  const recovery = selectRecoveryPath({
    inactivity_type: params.inactivityType,
    severity: params.severity,
    hours_inactive: params.hoursInactive,
  });

  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const base = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "blueprint" as const,
    entityId: params.blueprintId,
  };

  if (params.severity === "SHORT") {
    logger.info(
      { blueprintId: params.blueprintId, hours: params.hoursInactive },
      "[InactivityDetectionEngine] SHORT absence — watch window only",
    );
    return;
  }

  await writeEvent({
    ...base,
    eventType: EVENT_TYPES.INACTIVITY_DETECTED,
    payload: {
      inactivity_record_id: params.recordId,
      severity: params.severity,
      hours_inactive: params.hoursInactive,
      inactivity_type: params.inactivityType,
    },
    idempotencyKey: `inactivity_detected:${params.recordId}:${hourBucket}`,
  });

  if (params.hoursInactive >= 336) {
    await writeEvent({
      ...base,
      eventType: EventTypes.ABANDONMENT_RISK,
      payload: {
        inactivity_record_id: params.recordId,
        days_inactive: params.hoursInactive / 24,
      },
      idempotencyKey: `abandonment_risk:${params.recordId}:${hourBucket}`,
    });
  }

  for (const eventType of recovery.secondary_events) {
    if (eventType === EVENT_TYPES.INACTIVITY_DETECTED) continue;
    await writeEvent({
      ...base,
      eventType,
      payload: recovery.payload,
      idempotencyKey: `${eventType}:inactivity:${params.recordId}:${hourBucket}`,
    }).catch(() => null);
  }

  if (recovery.primary_event !== EVENT_TYPES.INACTIVITY_DETECTED) {
    await writeEvent({
      ...base,
      eventType: recovery.primary_event,
      payload: recovery.payload,
      idempotencyKey: `${recovery.primary_event}:inactivity:${params.recordId}:${hourBucket}`,
    }).catch(() => null);
  }

  if (recovery.enforcement_task_limit_max != null) {
    await applyCriticalEnforcement(params.blueprintId, recovery.enforcement_task_limit_max);
  }
}

export type DetectInactivityResult = {
  recordId: string;
  severity: Doc11InactivitySeverity;
  hoursInactive: number;
  inactivityType: Doc11InactivityType;
  created: boolean;
};

export async function detectInactivity(
  userId: string,
  blueprintId: string,
): Promise<DetectInactivityResult | null> {
  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!blueprint || !blueprint.active || blueprint.status !== BlueprintStatus.ACTIVE) {
    return null;
  }

  const openOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        inArray(orders.status, [...OPEN_ORDER_STATUSES]),
      ),
    )
    .limit(1);

  if (openOrders.length === 0) {
    return null;
  }

  const lastFeedback = await getLastFeedbackTimestamp(userId, blueprintId);
  const lastOrderActivity = await getLastOrderActivityTimestamp(userId, blueprintId);
  const lastActivity = new Date(
    Math.max(
      lastFeedback?.getTime() ?? blueprint.created_at.getTime(),
      lastOrderActivity?.getTime() ?? blueprint.created_at.getTime(),
    ),
  );

  const hoursInactive = (Date.now() - lastActivity.getTime()) / 3_600_000;
  const severity = severityFromHoursInactive(hoursInactive);
  if (!severity) return null;

  const existing = await getOpenInactivityRecord(userId, blueprintId);
  const severityLabel = doc11SeverityLabel(severity);
  if (existing && existing.severity === severityLabel && existing.inactivity_type) {
    return {
      recordId: existing.id,
      severity,
      hoursInactive,
      inactivityType: existing.inactivity_type as Doc11InactivityType,
      created: false,
    };
  }

  const evidence = await buildEvidenceContext(userId, blueprintId);
  const classification = classifyInactivityReason(evidence);

  let recordId = existing?.id ?? "";
  if (existing) {
    await db
      .update(inactivityRecords)
      .set({
        last_activity_at: lastActivity,
        last_feedback_at: lastFeedback,
        inactivity_hours: hoursInactive,
        inactivity_days: hoursInactive / 24,
        inactivity_type: classification.inactivity_type,
        severity: severityLabel,
        threshold_breached: severity === "CRITICAL" ? "critical" : "soft",
        response_triggered: "doc11_scan",
      })
      .where(eq(inactivityRecords.id, existing.id));
    recordId = existing.id;
  } else {
    const [inserted] = await db
      .insert(inactivityRecords)
      .values({
        user_id: userId,
        blueprint_id: blueprintId,
        last_activity_at: lastActivity,
        last_feedback_at: lastFeedback,
        inactivity_hours: hoursInactive,
        inactivity_days: hoursInactive / 24,
        inactivity_type: classification.inactivity_type,
        severity: severityLabel,
        threshold_breached: severity === "CRITICAL" ? "critical" : "soft",
        response_triggered: "doc11_scan",
        resolved: false,
      })
      .returning({ id: inactivityRecords.id });
    recordId = inserted?.id ?? "";
  }

  if (!recordId) return null;

  const shouldEmit = !existing || existing.severity !== severityLabel;
  if (shouldEmit && severity !== "SHORT") {
    await emitRecoveryEvents({
      userId,
      blueprintId,
      recordId,
      severity,
      hoursInactive,
      inactivityType: classification.inactivity_type,
    });
  }

  return {
    recordId,
    severity,
    hoursInactive,
    inactivityType: classification.inactivity_type,
    created: !existing,
  };
}

export class Doc11InactivityDetectionEngine {
  detect(userId: string, blueprintId: string) {
    return detectInactivity(userId, blueprintId);
  }
}
