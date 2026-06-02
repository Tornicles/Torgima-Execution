/**
 * Phase 1 DOC 11 — inactivity detection (diagnose + recover, never punish).
 */

import {
  db,
  blueprints,
  feedback,
  orders,
  inactivityRecords,
  executionSessions,
  systemHealthLogs,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { BlueprintStatus, OrderStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { isBlueprintExecutionLocked } from "../health/ExecutionLock.js";
import {
  PHASE1_INACTIVITY_THRESHOLDS_MIN,
  classifyInactivity,
  maxSeverity,
  parseCommitmentLevel,
  scaleThresholdMinutes,
  severityForType,
  type InactivitySeverity,
  type InactivityType,
} from "./InactivityThresholds.js";
import { recordInactivityWorkerRun } from "../state/SystemHealthMonitor.js";

let lastScanCompletedAt: Date | null = null;

export function getLastInactivityScanAt(): Date | null {
  return lastScanCompletedAt;
}

export function markInactivityScanComplete(): void {
  lastScanCompletedAt = new Date();
  recordInactivityWorkerRun();
}

/** GAP G5 — eligibility for scheduled inactivity scan. */
export async function isBlueprintEligibleForInactivityScan(
  blueprintId: string,
  status: string,
  active: boolean,
): Promise<boolean> {
  if (!active || status !== BlueprintStatus.ACTIVE) return false;
  const lock = await isBlueprintExecutionLocked(blueprintId);
  if (lock.locked) return false;
  return true;
}

function blueprintSkipped(blueprint: typeof blueprints.$inferSelect): boolean {
  if (blueprint.paused_at) return true;
  if (blueprint.completed_at) return true;
  const meta = blueprint.metadata as Record<string, unknown> | null;
  if (meta?.system_locked === true) return true;
  return false;
}

type DimensionHit = {
  type: InactivityType;
  elapsedMinutes: number;
};

function detectDimensions(params: {
  commitment: ReturnType<typeof parseCommitmentLevel>;
  lastSessionAt: Date | null;
  lastOrderActionAt: Date | null;
  lastFeedbackAt: Date | null;
  orderStartedAt: Date | null;
  orderDueAt: Date | null;
  missedWindows7d: number;
  hasOpenOrders: boolean;
  hasActiveOrder: boolean;
}): DimensionHit | null {
  const now = Date.now();
  const hits: DimensionHit[] = [];

  const minsSince = (d: Date | null) =>
    d ? (now - d.getTime()) / 60000 : Number.POSITIVE_INFINITY;

  const sessionThreshold = scaleThresholdMinutes(
    PHASE1_INACTIVITY_THRESHOLDS_MIN.NO_SESSION,
    params.commitment,
  );
  if (params.hasOpenOrders && minsSince(params.lastSessionAt) >= sessionThreshold) {
    hits.push({ type: "NO_SESSION", elapsedMinutes: minsSince(params.lastSessionAt) });
  }

  const orderActionThreshold = scaleThresholdMinutes(
    PHASE1_INACTIVITY_THRESHOLDS_MIN.NO_ORDER_ACTION,
    params.commitment,
  );
  if (params.hasActiveOrder && minsSince(params.lastOrderActionAt) >= orderActionThreshold) {
    hits.push({ type: "NO_ORDER_ACTION", elapsedMinutes: minsSince(params.lastOrderActionAt) });
  }

  const feedbackThreshold = scaleThresholdMinutes(
    PHASE1_INACTIVITY_THRESHOLDS_MIN.NO_FEEDBACK,
    params.commitment,
  );
  if (params.orderStartedAt) {
    const sinceStart = minsSince(params.orderStartedAt);
    if (sinceStart >= feedbackThreshold && minsSince(params.lastFeedbackAt) >= feedbackThreshold) {
      hits.push({ type: "NO_FEEDBACK", elapsedMinutes: minsSince(params.lastFeedbackAt) });
    }
  }

  if (params.orderDueAt) {
    const grace = scaleThresholdMinutes(
      PHASE1_INACTIVITY_THRESHOLDS_MIN.MISSED_DUE_WINDOW_GRACE,
      params.commitment,
    );
    const overdueBy = (now - params.orderDueAt.getTime()) / 60000;
    if (overdueBy >= grace && minsSince(params.lastFeedbackAt) > overdueBy) {
      hits.push({ type: "MISSED_DUE_WINDOW", elapsedMinutes: overdueBy });
    }
  }

  if (params.missedWindows7d >= PHASE1_INACTIVITY_THRESHOLDS_MIN.REPEATED_DELAY_COUNT) {
    hits.push({ type: "REPEATED_DELAY", elapsedMinutes: params.missedWindows7d * 60 });
  }

  const abandonedThreshold = scaleThresholdMinutes(
    PHASE1_INACTIVITY_THRESHOLDS_MIN.ABANDONED_LOOP,
    params.commitment,
  );
  if (minsSince(params.lastFeedbackAt) >= abandonedThreshold) {
    hits.push({ type: "ABANDONED_LOOP", elapsedMinutes: minsSince(params.lastFeedbackAt) });
  }

  if (hits.length === 0) return null;

  const rank: Record<InactivityType, number> = {
    NO_SESSION: 1,
    NO_ORDER_ACTION: 2,
    NO_FEEDBACK: 3,
    MISSED_DUE_WINDOW: 4,
    REPEATED_DELAY: 5,
    SYSTEM_STALE: 4,
    ABANDONED_LOOP: 6,
  };

  hits.sort((a, b) => rank[b.type] - rank[a.type]);
  return hits[0] ?? null;
}

async function emitResponseEvents(params: {
  severity: InactivitySeverity;
  type: InactivityType;
  blueprintId: string;
  userId: string;
  elapsedMinutes: number;
}): Promise<string | undefined> {
  const hourBucket = Math.floor(Date.now() / 3600000);
  const base = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "blueprint" as const,
    entityId: params.blueprintId,
  };

  if (params.severity === "INFO") return undefined;

  if (params.severity === "LOW") {
    return writeEvent({
      ...base,
      eventType: EVENT_TYPES.REMINDER_REQUESTED,
      payload: {
        inactivity_type: params.type,
        severity: params.severity,
        elapsed_minutes: Math.round(params.elapsedMinutes),
      },
      idempotencyKey: `reminder:${params.blueprintId}:${params.type}:${hourBucket}`,
    });
  }

  if (params.severity === "MEDIUM") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
      payload: { reason: "inactivity", inactivity_type: params.type },
      idempotencyKey: `signal_recalc:inactivity:${params.blueprintId}:${hourBucket}`,
    }).catch(() => null);

    return writeEvent({
      ...base,
      eventType: EVENT_TYPES.REMINDER_REQUESTED,
      payload: { inactivity_type: params.type, severity: params.severity },
      idempotencyKey: `reminder:${params.blueprintId}:${params.type}:med:${hourBucket}`,
    });
  }

  if (params.severity === "HIGH") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
      payload: { reason: "inactivity", inactivity_type: params.type },
      idempotencyKey: `condition_eval:inactivity:${params.blueprintId}:${hourBucket}`,
    }).catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.RECOVERY_TASK_REQUESTED,
      payload: { inactivity_type: params.type },
      idempotencyKey: `recovery_task:inactivity:${params.blueprintId}:${hourBucket}`,
    }).catch(() => null);

    return writeEvent({
      ...base,
      eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
      payload: { reason: "inactivity_high", inactivity_type: params.type },
      idempotencyKey: `signal_recalc:inactivity_high:${params.blueprintId}:${hourBucket}`,
    });
  }

  if (params.severity === "CRITICAL") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.TASK_GUARANTEE_REQUESTED,
      payload: { mode: "recovery", inactivity_type: params.type },
      idempotencyKey: `task_guarantee:inactivity:${params.blueprintId}:${hourBucket}`,
    }).catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
      payload: { reason: "inactivity_critical", inactivity_type: params.type },
      idempotencyKey: `condition_eval:inactivity_crit:${params.blueprintId}:${hourBucket}`,
    }).catch(() => null);

    await db.insert(systemHealthLogs).values({
      check_type: "INACTIVITY_CRITICAL",
      severity: "CRITICAL",
      status: "OPEN",
      area: "inactivity",
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      message: `Critical inactivity: ${params.type} (${Math.round(params.elapsedMinutes)}m)`,
      details_json: { type: params.type, elapsed_minutes: params.elapsedMinutes },
    }).catch(() => null);
  }

  return undefined;
}

async function scanBlueprint(
  blueprint: typeof blueprints.$inferSelect,
): Promise<"detected" | "resolved" | "ok"> {
  const userId = blueprint.user_id;
  const commitment = parseCommitmentLevel(blueprint.commitment_level);

  const [lastFb] = await db
    .select({ created_at: feedback.created_at })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprint.id), eq(feedback.user_id, userId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  const [lastSession] = await db
    .select({ started_at: executionSessions.started_at })
    .from(executionSessions)
    .where(eq(executionSessions.blueprint_id, blueprint.id))
    .orderBy(desc(executionSessions.started_at))
    .limit(1);

  const openOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      started_at: orders.started_at,
      due_date: orders.due_date,
      updated_at: orders.updated_at,
    })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprint.id),
        eq(orders.user_id, userId),
        inArray(orders.status, [
          OrderStatus.PENDING,
          OrderStatus.ACTIVE,
          OrderStatus.NEEDS_FEEDBACK,
          OrderStatus.BLOCKED,
        ]),
      ),
    );

  const activeOrder = openOrders.find((o) => o.status === OrderStatus.ACTIVE) ?? openOrders[0];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [{ missedCount } = { missedCount: 0 }] = await db
    .select({ missedCount: sql<number>`count(*)::int` })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.blueprint_id, blueprint.id),
        eq(inactivityRecords.inactivity_type, "MISSED_DUE_WINDOW"),
        gte(inactivityRecords.created_at, sevenDaysAgo),
      ),
    );

  const hit = detectDimensions({
    commitment,
    lastSessionAt: lastSession?.started_at ?? null,
    lastOrderActionAt: activeOrder?.started_at ?? activeOrder?.updated_at ?? null,
    lastFeedbackAt: lastFb?.created_at ?? blueprint.created_at,
    orderStartedAt: activeOrder?.started_at ?? null,
    orderDueAt: activeOrder?.due_date ?? null,
    missedWindows7d: missedCount ?? 0,
    hasOpenOrders: openOrders.length > 0,
    hasActiveOrder: Boolean(activeOrder),
  });

  if (!hit) {
    const [open] = await db
      .select({ id: inactivityRecords.id })
      .from(inactivityRecords)
      .where(
        and(
          eq(inactivityRecords.blueprint_id, blueprint.id),
          eq(inactivityRecords.resolved, false),
        ),
      )
      .limit(1);

    if (open) {
      await db
        .update(inactivityRecords)
        .set({ resolved: true, resolved_at: new Date(), response_triggered: "cleared" })
        .where(eq(inactivityRecords.id, open.id));
      return "resolved";
    }
    return "ok";
  }

  let severity = severityForType(hit.type);

  const [existing] = await db
    .select()
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.blueprint_id, blueprint.id),
        eq(inactivityRecords.inactivity_type, hit.type),
        eq(inactivityRecords.resolved, false),
      ),
    )
    .limit(1);

  if (existing?.severity) {
    severity = maxSeverity(existing.severity as InactivitySeverity, severity);
  }

  const recordValues = {
    last_activity_at: lastFb?.created_at ?? blueprint.created_at,
    last_feedback_at: lastFb?.created_at ?? null,
    inactivity_hours: hit.elapsedMinutes / 60,
    inactivity_days: hit.elapsedMinutes / (60 * 24),
    inactivity_type: hit.type,
    severity,
    threshold_breached: "soft" as const,
    response_triggered: severity === "CRITICAL" ? "recovery_pending" : "scan_pending",
  };

  if (existing) {
    await db
      .update(inactivityRecords)
      .set(recordValues)
      .where(eq(inactivityRecords.id, existing.id));
  } else {
    await db.insert(inactivityRecords).values({
      user_id: userId,
      blueprint_id: blueprint.id,
      resolved: false,
      ...recordValues,
    });
  }

  const shouldEmit =
    !existing ||
    maxSeverity(
      (existing.severity as InactivitySeverity) ?? "LOW",
      severity,
    ) !== ((existing.severity as InactivitySeverity) ?? "LOW");

  if (shouldEmit) {
    const eventId = await emitResponseEvents({
      severity,
      type: hit.type,
      blueprintId: blueprint.id,
      userId,
      elapsedMinutes: hit.elapsedMinutes,
    });

    if (eventId && existing) {
      await db
        .update(inactivityRecords)
        .set({ response_event_id: eventId })
        .where(eq(inactivityRecords.id, existing.id));
    }
  }

  return "detected";
}

export async function scanForInactivity(): Promise<{
  scanned: number;
  detected: number;
  resolved: number;
  skipped: number;
}> {
  return scanAll();
}

export async function scanAll(): Promise<{
  scanned: number;
  detected: number;
  resolved: number;
  skipped: number;
}> {
  let scanned = 0;
  let detected = 0;
  let resolved = 0;
  let skipped = 0;

  const staleThreshold = scaleThresholdMinutes(PHASE1_INACTIVITY_THRESHOLDS_MIN.SYSTEM_STALE, "MEDIUM");
  if (lastScanCompletedAt) {
    const minsSinceScan = (Date.now() - lastScanCompletedAt.getTime()) / 60000;
    if (minsSinceScan >= staleThreshold) {
      logger.warn(
        { minsSinceScan },
        "[InactivityEngine] SYSTEM_STALE — prior scan exceeded window",
      );
    }
  }

  const rows = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, BlueprintStatus.ACTIVE)));

  for (const bp of rows) {
    if (blueprintSkipped(bp)) {
      skipped++;
      continue;
    }

    const lock = await isBlueprintExecutionLocked(bp.id);
    if (lock.locked) {
      skipped++;
      continue;
    }

    scanned++;
    try {
      const result = await scanBlueprint(bp);
      if (result === "detected") detected++;
      if (result === "resolved") resolved++;
    } catch (error) {
      logger.error(
        {
          blueprintId: bp.id,
          error: error instanceof Error ? error.message : String(error),
        },
        "[InactivityEngine] Scan failed for blueprint",
      );
    }
  }

  markInactivityScanComplete();

  logger.info({ scanned, detected, resolved, skipped }, "[InactivityEngine] scanAll complete");
  return { scanned, detected, resolved, skipped };
}

export class InactivityDetectionEngine {
  scanAll() {
    return scanAll();
  }

  scan() {
    return scanAll();
  }

  static classify(hoursInactive: number) {
    return classifyInactivity(hoursInactive);
  }
}

export interface CurrentInactivitySnapshot {
  blueprintId: string;
  active: boolean;
  severity: InactivitySeverity | null;
  inactivityType: InactivityType | null;
  lastActivityAt: string | null;
  inactivityHours: number | null;
  resolved: boolean;
  lastScanAt: string | null;
}

/** Phase 1 GET /api/v1/inactivity/current/:blueprintId */
export async function getCurrentInactivityForBlueprint(
  userId: string,
  blueprintId: string,
): Promise<CurrentInactivitySnapshot> {
  const [bp] = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!bp) {
    return {
      blueprintId,
      active: false,
      severity: null,
      inactivityType: null,
      lastActivityAt: null,
      inactivityHours: null,
      resolved: true,
      lastScanAt: getLastInactivityScanAt()?.toISOString() ?? null,
    };
  }

  const [open] = await db
    .select()
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.blueprint_id, blueprintId),
        eq(inactivityRecords.user_id, userId),
        eq(inactivityRecords.resolved, false),
      ),
    )
    .orderBy(desc(inactivityRecords.created_at))
    .limit(1);

  if (!open) {
    return {
      blueprintId,
      active: false,
      severity: null,
      inactivityType: null,
      lastActivityAt: null,
      inactivityHours: null,
      resolved: true,
      lastScanAt: getLastInactivityScanAt()?.toISOString() ?? null,
    };
  }

  const severity = (open.severity?.toUpperCase() ?? "LOW") as InactivitySeverity;
  const type = (open.inactivity_type ?? null) as InactivityType | null;

  return {
    blueprintId,
    active: true,
    severity,
    inactivityType: type,
    lastActivityAt: open.last_activity_at.toISOString(),
    inactivityHours: open.inactivity_hours,
    resolved: false,
    lastScanAt: getLastInactivityScanAt()?.toISOString() ?? null,
  };
}
