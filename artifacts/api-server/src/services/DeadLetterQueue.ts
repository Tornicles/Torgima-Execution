/**
 * DOC 16 — dead-letter queue service (Phase 2 canonical path).
 */

import crypto from "crypto";
import { db, deadLetterEvents, events } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { logger } from "../lib/logger.js";
import { deadLetterEvent } from "../engines/events/DeadLetterHandler.js";
import { writeEvent, EVENT_TYPES } from "./EventService.js";
import { EventTypes } from "../types/eventContracts.js";

export type DeadLetterFailureCategory =
  | "VALIDATION"
  | "PERMISSION"
  | "STALE_STATE"
  | "MISSING_DEPENDENCY"
  | "MAX_RETRIES_EXCEEDED"
  | "SYSTEM_ERROR";

export interface DeadLetterEventRecord {
  id: string;
  originalEventId: string;
  eventType: string;
  userId?: string;
  blueprintId?: string;
  payloadHash: string;
  failureReason: string;
  failureCategory: DeadLetterFailureCategory;
  finalAttemptCount: number;
  lastErrorMessage: string;
  replayAllowed: boolean;
  repairRequired: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

const CRITICAL_BLOCKING = new Set<string>([
  EventTypes.FEEDBACK_SUBMITTED,
  EventTypes.SIGNAL_RECALCULATION_REQUESTED,
  EventTypes.CONDITION_EVALUATED,
  EventTypes.TASK_GENERATION_REQUESTED,
  EventTypes.ENFORCEMENT_PACKAGE_CREATED,
]);

function payloadHash(payload: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload ?? {}))
    .digest("hex")
    .slice(0, 32);
}

function mapFailureCategory(
  reason: string,
  failureClass: "transient" | "permanent",
): DeadLetterFailureCategory {
  const r = reason.toLowerCase();
  if (r.includes("stale") || r.includes("version")) return "STALE_STATE";
  if (r.includes("permission") || r.includes("forbidden")) return "PERMISSION";
  if (r.includes("validation")) return "VALIDATION";
  if (r.includes("missing") || r.includes("not found")) return "MISSING_DEPENDENCY";
  if (failureClass === "permanent") return "PERMISSION";
  return "MAX_RETRIES_EXCEEDED";
}

function replayAllowedFor(category: DeadLetterFailureCategory): boolean {
  return category !== "PERMISSION" && category !== "STALE_STATE";
}

function repairRequiredFor(category: DeadLetterFailureCategory): boolean {
  return category === "STALE_STATE";
}

function toRecord(row: typeof deadLetterEvents.$inferSelect): DeadLetterEventRecord {
  const category = mapFailureCategory(
    row.failure_reason,
    row.failure_class === "permanent" ? "permanent" : "transient",
  );
  return {
    id: row.id,
    originalEventId: row.original_event_id,
    eventType: row.event_type,
    userId: row.user_id ?? undefined,
    blueprintId: row.blueprint_id ?? undefined,
    payloadHash: payloadHash(row.payload),
    failureReason: row.failure_reason,
    failureCategory: category,
    finalAttemptCount: row.retry_count,
    lastErrorMessage: row.last_error ?? row.failure_reason,
    replayAllowed: replayAllowedFor(category),
    repairRequired: repairRequiredFor(category),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

export class DeadLetterQueue {
  async listUnresolved(limit = 100): Promise<DeadLetterEventRecord[]> {
    const rows = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.resolved, false))
      .orderBy(desc(deadLetterEvents.created_at))
      .limit(limit);
    return rows.map(toRecord);
  }

  async createFromFailedEvent(params: {
    eventId: string;
    reason: string;
    lastError: string;
    failureClass?: "transient" | "permanent";
    dispatchFailures?: number;
  }): Promise<DeadLetterEventRecord | null> {
    const maxDispatchAttempts = 3;
    if ((params.dispatchFailures ?? 0) < maxDispatchAttempts && params.failureClass !== "permanent") {
      return null;
    }

    await deadLetterEvent(
      params.eventId,
      params.reason,
      params.lastError,
      params.failureClass ?? "transient",
    );

    const [row] = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.original_event_id, params.eventId))
      .limit(1);

    if (!row) return null;

    const record = toRecord(row);
    const [event] = await db
      .select({ event_type: events.event_type, blueprint_id: events.blueprint_id })
      .from(events)
      .where(eq(events.id, params.eventId))
      .limit(1);

    if (event && CRITICAL_BLOCKING.has(event.event_type)) {
      await writeEvent({
        eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
        entityType: "event",
        entityId: params.eventId,
        blueprintId: event.blueprint_id ?? undefined,
        payload: {
          reason: "critical_event_dead_lettered",
          event_type: event.event_type,
          failure_category: record.failureCategory,
        },
        idempotencyKey: `dlq_health:${params.eventId}`,
      }).catch(() => null);
    }

    logger.error(
      { eventId: params.eventId, category: record.failureCategory },
      "[DeadLetterQueue] Event dead-lettered",
    );

    return record;
  }

  async replay(dlqId: string): Promise<{ replayed: boolean; eventId?: string }> {
    const [dlq] = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.id, dlqId))
      .limit(1);

    if (!dlq) return { replayed: false };

    const record = toRecord(dlq);
    if (!record.replayAllowed) {
      throw new Error(`Replay not allowed for failure category ${record.failureCategory}`);
    }

    await db
      .update(events)
      .set({
        status: EventStatus.PENDING,
        retry_count: 0,
        process_after: new Date(),
      })
      .where(eq(events.id, dlq.original_event_id));

    await db
      .update(deadLetterEvents)
      .set({
        resolved: true,
        resolved_at: new Date(),
        resolution_status: "REPLAYING",
        reviewed: true,
        reviewed_at: new Date(),
      })
      .where(eq(deadLetterEvents.id, dlqId));

    return { replayed: true, eventId: dlq.original_event_id };
  }

  async cancel(dlqId: string, reason: string): Promise<void> {
    const [dlq] = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.id, dlqId))
      .limit(1);

    if (!dlq) return;

    await db
      .update(deadLetterEvents)
      .set({
        resolved: true,
        resolved_at: new Date(),
        resolution_status: "RESOLVED",
        reviewed: true,
        reviewed_at: new Date(),
      })
      .where(eq(deadLetterEvents.id, dlqId));

    await db
      .update(events)
      .set({ status: EventStatus.CANCELLED })
      .where(
        and(eq(events.id, dlq.original_event_id), eq(events.status, EventStatus.DEAD_LETTERED)),
      );

    logger.info({ dlqId, reason }, "[DeadLetterQueue] DLQ entry cancelled");
  }
}

export const deadLetterQueue = new DeadLetterQueue();
