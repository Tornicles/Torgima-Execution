import { db, pool } from "@workspace/db";
import { events, eventLogs } from "@workspace/db";
import { eq, and, lte, inArray, or } from "drizzle-orm";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";
import { EventStatus } from "@workspace/state-machine";
import { EVENT_QUEUE_MAP, TERMINAL_EVENT_TYPES, EventTypes } from "../types/eventContracts.js";
import { claimDeadlineFromNow } from "../engines/events/StuckEventDetector.js";
import { getNextRunAfter } from "../engines/events/RetryPolicy.js";
import { deadLetterQueue } from "./DeadLetterQueue.js";

const DISPATCH_BATCH_SIZE = 50;
const MAX_DISPATCH_ATTEMPTS = 3;

const PRIORITY_EVENT_TYPES = new Set<string>([
  EventTypes.FEEDBACK_SUBMITTED,
  EventTypes.TASK_GENERATION_REQUESTED,
  EventTypes.CONDITION_EVALUATED,
]);

export async function dispatchPendingEvents(): Promise<number> {
  // Claim a batch of PENDING events atomically
  const pendingEvents = await db.transaction(async (tx) => {
    const now = new Date();
    const pending = await tx
      .select()
      .from(events)
      .where(
        and(
          or(
            eq(events.status, EventStatus.PENDING),
            eq(events.status, EventStatus.RETRY_PENDING),
          ),
          lte(events.process_after, now),
        ),
      )
      .orderBy(events.created_at)
      .limit(DISPATCH_BATCH_SIZE);

    if (pending.length === 0) return [];

    pending.sort((a, b) => {
      const aPri = PRIORITY_EVENT_TYPES.has(a.event_type) ? 0 : 1;
      const bPri = PRIORITY_EVENT_TYPES.has(b.event_type) ? 0 : 1;
      if (aPri !== bPri) return aPri - bPri;
      return a.created_at.getTime() - b.created_at.getTime();
    });

    const ids = pending.map((e) => e.id);
    const claimDeadline = claimDeadlineFromNow();
    await tx
      .update(events)
      .set({ status: EventStatus.CLAIMED, process_after: claimDeadline })
      .where(inArray(events.id, ids));

    return pending;
  });

  if (pendingEvents.length === 0) return 0;

  const boss = await getBoss();
  let dispatched = 0;

  for (const event of pendingEvents) {
    const queueName = EVENT_QUEUE_MAP[event.event_type];

    if (!queueName) {
      if (TERMINAL_EVENT_TYPES.has(event.event_type)) {
        // Audit-only event — mark processed quietly.
        await markEventProcessed(event.id, "success");
      } else {
        logger.warn(
          { eventType: event.event_type, eventId: event.id },
          "[EventDispatcher] No queue mapping for event type",
        );
        await markEventProcessed(event.id, "noop_duplicate");
      }
      continue;
    }

    try {
      // Idempotency check — skip if already successfully processed
      if (event.idempotency_key) {
        const [existing] = await db
          .select({ id: eventLogs.id })
          .from(eventLogs)
          .where(and(eq(eventLogs.event_id, event.id), eq(eventLogs.result, "success")))
          .limit(1);
        if (existing) {
          await markEventProcessed(event.id, "noop_duplicate");
          continue;
        }
      }

      await boss.send(queueName, {
        eventId: event.id,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id,
        userId: event.user_id,
        blueprintId: event.blueprint_id,
        payload: event.payload,
      });

      await db
        .insert(eventLogs)
        .values({
          event_id: event.id,
          worker: "EventDispatcher",
          result: "success",
          processed_at: new Date(),
        })
        .catch(() => null);

      dispatched++;
      logger.debug(
        { eventId: event.id, queue: queueName },
        "[EventDispatcher] Event dispatched to queue",
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        { eventId: event.id, error: errMsg },
        "[EventDispatcher] Failed to dispatch event",
      );

      await db
        .insert(eventLogs)
        .values({
          event_id: event.id,
          worker: "EventDispatcher",
          result: "failed",
          error_message: errMsg,
          processed_at: new Date(),
        })
        .catch(() => null);

      const nextRetry = event.retry_count + 1;

      if (nextRetry >= MAX_DISPATCH_ATTEMPTS) {
        await deadLetterQueue
          .createFromFailedEvent({
            eventId: event.id,
            reason: "MAX_RETRIES_EXCEEDED",
            lastError: errMsg,
            failureClass: "transient",
            dispatchFailures: nextRetry,
          })
          .catch(() => null);
      } else {
        await db
          .update(events)
          .set({
            status: EventStatus.RETRY_PENDING,
            retry_count: nextRetry,
            process_after: getNextRunAfter(event.event_type, event.retry_count),
          })
          .where(eq(events.id, event.id))
          .catch(() => null);
      }
    }
  }

  return dispatched;
}

export async function getEventSystemHealth(): Promise<{
  pending_events: number;
  unresolved_dead_letters: number;
}> {
  const pendingResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM events WHERE status = '${EventStatus.PENDING}'`,
  );
  const dlResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM dead_letter_events WHERE resolved = false",
  );
  return {
    pending_events: parseInt(pendingResult.rows[0]?.count ?? "0", 10),
    unresolved_dead_letters: parseInt(dlResult.rows[0]?.count ?? "0", 10),
  };
}

async function markEventProcessed(eventId: string, result: "success" | "noop_duplicate"): Promise<void> {
  await db.update(events).set({ status: EventStatus.PROCESSED }).where(eq(events.id, eventId)).catch(() => null);
  await db
    .insert(eventLogs)
    .values({ event_id: eventId, result, processed_at: new Date() })
    .catch(() => null);
}
