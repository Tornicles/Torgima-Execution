import { db, blueprints, feedback, inactivityRecords, users } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

const INACTIVITY_THRESHOLDS: Record<string, Record<string, number>> = {
  full: { warning: 12, soft: 24, hard: 48, critical: 96 },
  high: { warning: 18, soft: 36, hard: 72, critical: 120 },
  medium: { warning: 24, soft: 48, hard: 96, critical: 168 },
  low: { warning: 36, soft: 72, hard: 120, critical: 240 },
};

export async function scanForInactivity(): Promise<{
  scanned: number;
  detected: number;
  resolved: number;
}> {
  let scanned = 0;
  let detected = 0;
  let resolved = 0;

  const rows = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  for (const bp of rows) {
    scanned++;
    try {
      const [userRow] = await db
        .select({ commitment_level: users.commitment_level })
        .from(users)
        .where(eq(users.id, bp.user_id))
        .limit(1);

      const result = await scanBlueprint(bp, userRow?.commitment_level ?? "medium");
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

  logger.info({ scanned, detected, resolved }, "[InactivityEngine] Scan complete");
  return { scanned, detected, resolved };
}

async function scanBlueprint(
  blueprint: typeof blueprints.$inferSelect,
  commitmentLevel: string,
): Promise<"detected" | "resolved" | "ok"> {
  const userId = blueprint.user_id;
  const thresholds = INACTIVITY_THRESHOLDS[commitmentLevel] ?? INACTIVITY_THRESHOLDS.medium;

  const [lastFb] = await db
    .select({ created_at: feedback.created_at })
    .from(feedback)
    .where(and(eq(feedback.blueprint_id, blueprint.id), eq(feedback.user_id, userId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  const lastActivityAt = lastFb?.created_at ?? blueprint.created_at;
  const hoursInactive = (Date.now() - lastActivityAt.getTime()) / 3600000;

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

  if (existingRecord && hoursInactive < thresholds.warning) {
    await db
      .update(inactivityRecords)
      .set({ resolved: true, resolved_at: new Date() })
      .where(eq(inactivityRecords.id, existingRecord.id));
    return "resolved";
  }

  let thresholdBreached: "warning" | "soft" | "hard" | "critical" | null = null;
  if (hoursInactive >= thresholds.critical) thresholdBreached = "critical";
  else if (hoursInactive >= thresholds.hard) thresholdBreached = "hard";
  else if (hoursInactive >= thresholds.soft) thresholdBreached = "soft";
  else if (hoursInactive >= thresholds.warning) thresholdBreached = "warning";

  if (!thresholdBreached) return "ok";

  if (existingRecord && existingRecord.threshold_breached === thresholdBreached) {
    return "ok";
  }

  if (existingRecord) {
    await db
      .update(inactivityRecords)
      .set({
        threshold_breached: thresholdBreached,
        inactivity_hours: hoursInactive,
        inactivity_days: hoursInactive / 24,
      })
      .where(eq(inactivityRecords.id, existingRecord.id));
  } else {
    await db.insert(inactivityRecords).values({
      user_id: userId,
      blueprint_id: blueprint.id,
      last_activity_at: lastActivityAt,
      inactivity_hours: hoursInactive,
      inactivity_days: hoursInactive / 24,
      threshold_breached: thresholdBreached,
      response_triggered: "pending",
      resolved: false,
    });
  }

  const hourBucket = Math.floor(Date.now() / 3600000);

  if (thresholdBreached === "hard" || thresholdBreached === "critical") {
    await writeEvent({
      eventType: EVENT_TYPES.INACTIVITY_DETECTED,
      entityType: "blueprint",
      entityId: blueprint.id,
      userId,
      blueprintId: blueprint.id,
      payload: {
        threshold_breached: thresholdBreached,
        hours_inactive: hoursInactive,
        generation_mode: "recovery",
        generation_trigger: "inactivity_detected",
      },
      idempotencyKey: `inactivity:${blueprint.id}:${thresholdBreached}:${hourBucket}`,
    });
  }

  if (thresholdBreached === "warning" || thresholdBreached === "soft") {
    await writeEvent({
      eventType: EVENT_TYPES.REMINDER_REQUESTED,
      entityType: "blueprint",
      entityId: blueprint.id,
      userId,
      blueprintId: blueprint.id,
      payload: {
        reason: `inactivity_${thresholdBreached}`,
        severity: thresholdBreached,
        hours: Math.round(hoursInactive),
      },
      idempotencyKey: `reminder:${blueprint.id}:${thresholdBreached}:${hourBucket}`,
    });
  }

  logger.info(
    {
      blueprintId: blueprint.id,
      userId,
      threshold: thresholdBreached,
      hoursInactive: Math.round(hoursInactive),
    },
    "[InactivityEngine] Detected",
  );

  return "detected";
}

export class InactivityDetectionEngine {
  scan(): Promise<{ scanned: number; detected: number; resolved: number }> {
    return scanForInactivity();
  }
}
