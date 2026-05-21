import { db, blueprints, feedback, inactivityRecords, systemHealthLogs } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { isBlueprintExecutionLocked } from "../health/ExecutionLock.js";
import {
  classifyInactivity,
  requiresRecoveryEvent,
  INACTIVITY_DOC11_THRESHOLDS,
  type InactivityType,
  type InactivitySeverity,
  type ThresholdBreached,
} from "./InactivityThresholds.js";

const SKIPPED_STATUSES = ["paused", "complete", "archived"] as const;

export async function isBlueprintEligibleForInactivityScan(
  blueprintId: string,
  status: string,
  active: boolean,
): Promise<boolean> {
  if (!active) return false;
  if (SKIPPED_STATUSES.includes(status as (typeof SKIPPED_STATUSES)[number])) return false;
  const lock = await isBlueprintExecutionLocked(blueprintId);
  return !lock.locked;
}

export async function scanForInactivity(): Promise<{
  scanned: number;
  detected: number;
  resolved: number;
  skipped: number;
}> {
  let scanned = 0;
  let detected = 0;
  let resolved = 0;
  let skipped = 0;

  const rows = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  for (const bp of rows) {
    if (!(await isBlueprintEligibleForInactivityScan(bp.id, bp.status, bp.active))) {
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

  logger.info({ scanned, detected, resolved, skipped }, "[InactivityEngine] Scan complete");
  return { scanned, detected, resolved, skipped };
}

async function scanBlueprint(
  blueprint: typeof blueprints.$inferSelect,
): Promise<"detected" | "resolved" | "ok"> {
  const userId = blueprint.user_id;

  const [lastFb] = await db
    .select({ created_at: feedback.created_at })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprint.id), eq(feedback.user_id, userId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  const lastFeedbackAt = lastFb?.created_at ?? blueprint.created_at;
  const hoursInactive = (Date.now() - lastFeedbackAt.getTime()) / 3600000;

  const classification = classifyInactivity(hoursInactive);
  if (!classification) return "ok";

  const { type, severity, thresholdBreached } = classification;

  const [existingRecord] = await db
    .select()
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.blueprint_id, blueprint.id),
        eq(inactivityRecords.user_id, userId),
        eq(inactivityRecords.resolved, false),
      ),
    )
    .limit(1);

  if (existingRecord && hoursInactive < INACTIVITY_DOC11_THRESHOLDS.feedback_delay_warning) {
    await db
      .update(inactivityRecords)
      .set({ resolved: true, resolved_at: new Date() })
      .where(eq(inactivityRecords.id, existingRecord.id));
    return "resolved";
  }

  if (
    existingRecord &&
    existingRecord.threshold_breached === thresholdBreached &&
    existingRecord.inactivity_type === type
  ) {
    return "ok";
  }

  const recordValues = {
    last_activity_at: lastFeedbackAt,
    last_feedback_at: lastFeedbackAt,
    inactivity_hours: hoursInactive,
    inactivity_days: hoursInactive / 24,
    inactivity_type: type,
    severity,
    threshold_breached: thresholdBreached,
    response_triggered: requiresRecoveryEvent(thresholdBreached) ? "recovery_pending" : "reminder_pending",
  };

  if (existingRecord) {
    await db
      .update(inactivityRecords)
      .set(recordValues)
      .where(eq(inactivityRecords.id, existingRecord.id));
  } else {
    await db.insert(inactivityRecords).values({
      user_id: userId,
      blueprint_id: blueprint.id,
      resolved: false,
      ...recordValues,
    });
  }

  const hourBucket = Math.floor(Date.now() / 3600000);

  if (requiresRecoveryEvent(thresholdBreached)) {
    await writeEvent({
      eventType: EVENT_TYPES.INACTIVITY_DETECTED,
      entityType: "blueprint",
      entityId: blueprint.id,
      userId,
      blueprintId: blueprint.id,
      payload: {
        inactivity_type: type,
        severity,
        threshold_breached: thresholdBreached,
        hours_inactive: hoursInactive,
        generation_mode: "recovery",
        generation_trigger: "inactivity_detected",
      },
      idempotencyKey: `inactivity:${blueprint.id}:${type}:${hourBucket}`,
    });

    await writeEvent({
      eventType: EVENT_TYPES.REWARD_EVALUATION_REQUESTED,
      entityType: "blueprint",
      entityId: blueprint.id,
      userId,
      blueprintId: blueprint.id,
      payload: {
        source_type: "INACTIVITY",
        source_id: blueprint.id,
        source_event_id: blueprint.id,
        idempotency_key: `reward:inactivity:${blueprint.id}:${hourBucket}`,
      },
      idempotencyKey: `reward:inactivity:${blueprint.id}:${hourBucket}`,
    }).catch(() => null);
  } else if (thresholdBreached === "warning") {
    await writeEvent({
      eventType: EVENT_TYPES.REMINDER_REQUESTED,
      entityType: "blueprint",
      entityId: blueprint.id,
      userId,
      blueprintId: blueprint.id,
      payload: {
        inactivity_type: type,
        severity,
        reason: `inactivity_${type}`,
        hours: Math.round(hoursInactive),
      },
      idempotencyKey: `reminder:${blueprint.id}:${type}:${hourBucket}`,
    });
  }

  if (severity === "CRITICAL" && type === "ABANDONED_LOOP") {
    await recordCriticalAbandonmentHealthLog(blueprint.id, userId, hoursInactive);
  }

  logger.info(
    {
      blueprintId: blueprint.id,
      userId,
      type,
      severity,
      threshold: thresholdBreached,
      hoursInactive: Math.round(hoursInactive),
    },
    "[InactivityEngine] Detected",
  );

  return "detected";
}

async function recordCriticalAbandonmentHealthLog(
  blueprintId: string,
  userId: string,
  hoursInactive: number,
): Promise<void> {
  const dayKey = new Date().toISOString().slice(0, 10);
  await db.insert(systemHealthLogs).values({
    check_type: "INACTIVITY_CRITICAL_ABANDONMENT",
    severity: "CRITICAL",
    status: "OPEN",
    area: "inactivity",
    blueprint_id: blueprintId,
    message: `Blueprint abandoned for ${Math.round(hoursInactive)}h (14d+ threshold)`,
    user_id: userId,
    entity_type: "blueprint",
    entity_id: blueprintId,
    details_json: {
      hours_inactive: hoursInactive,
      threshold_hours: INACTIVITY_DOC11_THRESHOLDS.critical_abandonment,
    },
  }).catch((err) => {
    logger.warn(
      { blueprintId, err: err instanceof Error ? err.message : String(err) },
      "[InactivityEngine] Critical health log insert failed",
    );
  });

  logger.warn(
    { blueprintId, userId, hoursInactive: Math.round(hoursInactive) },
    "[InactivityEngine] CRITICAL abandonment logged",
  );
}

export class InactivityDetectionEngine {
  scan(): Promise<{ scanned: number; detected: number; resolved: number; skipped: number }> {
    return scanForInactivity();
  }

  static classify(
    hoursInactive: number,
  ): {
    type: InactivityType;
    severity: InactivitySeverity;
    thresholdBreached: ThresholdBreached;
  } | null {
    return classifyInactivity(hoursInactive);
  }
}
