/**
 * DOC16 — dead-letter facade for workers (canonical handler in engines/events).
 */

import { db, events, eventLogs } from "@workspace/db";
import { eq } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { EventTypes } from "../types/eventContracts.js";
import {
  deadLetterEvent as engineDeadLetterEvent,
  CRITICAL_EVENTS,
  isCriticalEventType,
} from "../engines/events/DeadLetterHandler.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { logger } from "../lib/logger.js";

export { CRITICAL_EVENTS, isCriticalEventType };
export { deadLetterEvent } from "../engines/events/DeadLetterHandler.js";

export interface MoveToDeadLetterParams {
  eventId: string;
  reason: string;
  lastError: string;
  failureClass?: "transient" | "permanent";
  workerName?: string;
  startedAt?: Date;
}

/** DOC16 dead-letter flow — mark event, create DLQ row, log, alert on critical types. */
export async function moveEventToDeadLetter(params: MoveToDeadLetterParams): Promise<void> {
  const [event] = await db
    .select({ event_type: events.event_type, blueprint_id: events.blueprint_id, user_id: events.user_id })
    .from(events)
    .where(eq(events.id, params.eventId))
    .limit(1);

  await engineDeadLetterEvent(
    params.eventId,
    params.reason,
    params.lastError,
    params.failureClass ?? "transient",
  );

  if (params.workerName && params.startedAt) {
    await db
      .insert(eventLogs)
      .values({
        event_id: params.eventId,
        worker: params.workerName,
        result: "dead_lettered",
        error_message: params.lastError,
        duration_ms: Date.now() - params.startedAt.getTime(),
        processed_at: new Date(),
      })
      .catch(() => null);
  }

  if (event && isCriticalEventType(event.event_type)) {
    await writeEvent({
      eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
      entityType: "event",
      entityId: params.eventId,
      userId: event.user_id ?? undefined,
      blueprintId: event.blueprint_id ?? undefined,
      payload: {
        reason: "critical_event_dead_lettered",
        event_type: event.event_type,
        failure_reason: params.reason,
        last_error: params.lastError,
      },
      idempotencyKey: `dlq_health:${params.eventId}`,
    }).catch(() => null);
  }

  logger.error(
    { eventId: params.eventId, reason: params.reason, eventType: event?.event_type },
    "[DeadLetterHandler] Event moved to dead letter",
  );
}

/** Replay a dead-lettered event — reset retry counter and re-queue. */
export async function replayDeadLetteredEvent(eventId: string): Promise<void> {
  await db
    .update(events)
    .set({
      status: EventStatus.PENDING,
      retry_count: 0,
      process_after: new Date(),
    })
    .where(eq(events.id, eventId));
}

/** DOC16 critical event list (also exported from engine handler). */
export const DOC16_CRITICAL_EVENTS = [
  EventTypes.FEEDBACK_SUBMITTED,
  EventTypes.TASK_GENERATION_REQUESTED,
  EventTypes.SIGNAL_RECALCULATION_REQUESTED,
  EventTypes.ORDER_AVAILABLE,
] as const;
