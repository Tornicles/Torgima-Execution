/**
 * GAP G2 — move failed events to dead_letter_events; never silent drop (DOC_16).
 */

import { db, events, deadLetterEvents, systemHealthLogs } from "@workspace/db";
import { eq } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { EventTypes } from "../../types/eventContracts.js";

const CRITICAL_EVENT_TYPES = new Set<string>([
  EventTypes.FEEDBACK_SUBMITTED,
  EventTypes.TASK_GENERATION_REQUESTED,
  EventTypes.SIGNAL_RECALCULATION_REQUESTED,
  EventTypes.ORDER_AVAILABLE,
  EventTypes.ENFORCEMENT_PACKAGE_CREATED,
  EventTypes.CONDITION_EVALUATED,
]);

/** DOC16 — exported critical event list for DLQ health alerts. */
export const CRITICAL_EVENTS = [...CRITICAL_EVENT_TYPES] as const;

export function isCriticalEventType(eventType: string): boolean {
  return CRITICAL_EVENT_TYPES.has(eventType);
}

export async function deadLetterEvent(
  eventId: string,
  reason: string,
  lastError: string,
  failureClass: "transient" | "permanent" = "transient",
): Promise<void> {
  await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) return;

    const [existingDlq] = await tx
      .select({ id: deadLetterEvents.id })
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.original_event_id, eventId))
      .limit(1);

    if (!existingDlq) {
      await tx.insert(deadLetterEvents).values({
        original_event_id: eventId,
        event_type: event.event_type,
        blueprint_id: event.blueprint_id,
        user_id: event.user_id,
        payload: (event.payload as Record<string, unknown>) ?? {},
        failure_reason: reason,
        failure_class: failureClass,
        resolution_status: "OPEN",
        retry_count: event.retry_count,
        last_error: lastError,
      });
    }

    await tx
      .update(events)
      .set({ status: EventStatus.DEAD_LETTERED, retry_count: event.retry_count })
      .where(eq(events.id, eventId));

    if (CRITICAL_EVENT_TYPES.has(event.event_type)) {
      const dlqMessage = `Critical event ${event.event_type} dead-lettered after ${event.retry_count} attempts: ${reason}`;
      await tx.insert(systemHealthLogs).values({
        area: "EVENT_SYSTEM",
        severity: "CRITICAL",
        blueprint_id: event.blueprint_id,
        user_id: event.user_id,
        check_type: "CRITICAL_EVENT_DEAD_LETTERED",
        message: dlqMessage,
        status: "OPEN",
        details_json: {
          area: "EVENT_SYSTEM",
          severity: "CRITICAL",
          event_type: event.event_type,
          event_id: eventId,
          message: dlqMessage,
          last_error: lastError,
        },
        issues_detected: ["CRITICAL_EVENT_DEAD_LETTERED"],
      });
    }
  });

  logger.error({ eventId, reason, lastError }, "[DeadLetterHandler] Event dead-lettered");
}
