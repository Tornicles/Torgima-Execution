import { db, pool } from "@workspace/db";
import { events, eventLogs } from "@workspace/db";
import { eq, and, lte, inArray, or } from "drizzle-orm";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";
import { isCloudflareRuntime } from "../lib/cloudflare-runtime.js";
import { EventStatus } from "@workspace/state-machine";
import { EVENT_QUEUE_MAP, TERMINAL_EVENT_TYPES, EventTypes } from "../types/eventContracts.js";
import { claimDeadlineFromNow } from "../engines/events/StuckEventDetector.js";
import { getNextRunAfter } from "../engines/events/RetryPolicy.js";
import { deadLetterQueue } from "./DeadLetterQueue.js";

/** Default bounded batch for cron / inline drain. */
export const EVENT_DISPATCH_BATCH_SIZE_DEFAULT = 5;

/** Node server poll may process larger batches when not on Cloudflare. */
export const DISPATCH_BATCH_SIZE = 25;

/** Hard cap for Cloudflare cron invocations (Worker subrequest budget). */
export const MAX_EVENTS_PER_CRON = 5;

/** Stop dispatch work before Worker subrequest/time limits are hit. */
export const MAX_PROCESSING_MS = 5_000;

/** Documented safe subrequest budget for cron ticks (enqueue-only, no inline chains). */
export const MAX_SUBREQUESTS_PER_CRON_SAFE_LIMIT = 10;

export const MAX_DISPATCH_ATTEMPTS = 3;

const PRIORITY_EVENT_TYPES = new Set<string>([
  EventTypes.FEEDBACK_SUBMITTED,
  EventTypes.FEEDBACK_SUBMITTED_PARTIAL,
  EventTypes.INTERROGATION_ANSWERED,
  EventTypes.SIGNAL_RECALCULATION_REQUESTED,
  EventTypes.SIGNAL_CALCULATED,
  EventTypes.CONDITION_EVALUATION_REQUESTED,
  EventTypes.CONDITION_EVALUATED,
  EventTypes.ENFORCEMENT_PACKAGE_CREATED,
  EventTypes.TASK_GENERATION_REQUESTED,
  EventTypes.TASK_GENERATION_COMPLETED,
  EventTypes.TASK_GENERATION_FAILED,
  EventTypes.ORDER_AVAILABLE,
  EventTypes.ERECTOR_SIGNAL_CALCULATED,
  EventTypes.OUTCOME_VALIDATED,
  EventTypes.ERECTOR_BLUEPRINT_LAUNCHED,
]);

type EventRow = typeof events.$inferSelect;

export type DispatchPendingOptions = {
  /** Cron polls log at info; API/inline callers stay quieter. */
  logContext?: "cron" | "default";
};

/** Kill-switch: default off unless explicitly enabled in Worker env. */
export function isEventDispatchCronEnabled(): boolean {
  const raw = process.env.EVENT_DISPATCH_CRON_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function parseBatchEnv(...names: string[]): number | undefined {
  for (const name of names) {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === "") continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

/** Reads EVENT_DISPATCH_BATCH_SIZE / EVENT_DISPATCH_CRON_BATCH_SIZE; defaults to 5. */
export function getCronDispatchBatchSize(): number {
  const parsed =
    parseBatchEnv("EVENT_DISPATCH_BATCH_SIZE", "EVENT_DISPATCH_CRON_BATCH_SIZE") ??
    EVENT_DISPATCH_BATCH_SIZE_DEFAULT;
  const cap = isCloudflareRuntime() ? MAX_EVENTS_PER_CRON : DISPATCH_BATCH_SIZE;
  return Math.min(parsed, cap);
}

function resolveBatchSize(batchSize?: number): number {
  if (batchSize !== undefined) {
    return Math.max(1, Math.min(batchSize, DISPATCH_BATCH_SIZE));
  }
  return getCronDispatchBatchSize();
}

async function claimPendingEvents(limit: number): Promise<EventRow[]> {
  return db.transaction(async (tx) => {
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
      .limit(limit)
      .for("update", { skipLocked: true });

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
}

async function releaseClaimedEventToRetry(event: EventRow, reason: string): Promise<void> {
  await db
    .update(events)
    .set({
      status: EventStatus.RETRY_PENDING,
      process_after: getNextRunAfter(event.event_type, event.retry_count),
    })
    .where(eq(events.id, event.id))
    .catch(() => null);
  logger.info(
    { eventId: event.id, eventType: event.event_type, reason },
    "[EventDispatcher] Released claimed event to retry",
  );
}

async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: events.status })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return row?.status === EventStatus.PROCESSED;
}

async function enqueueClaimedEvent(
  event: EventRow,
  logContext: "cron" | "default",
): Promise<"enqueued" | "noop" | "failed"> {
  const queueName = EVENT_QUEUE_MAP[event.event_type];

  if (!queueName) {
    if (TERMINAL_EVENT_TYPES.has(event.event_type)) {
      await markEventProcessed(event.id, "success");
      return "noop";
    }
    logger.warn(
      { eventType: event.event_type, eventId: event.id },
      "[EventDispatcher] No queue mapping for event type",
    );
    await markEventProcessed(event.id, "noop_duplicate");
    return "noop";
  }

  if (event.idempotency_key && (await isEventAlreadyProcessed(event.id))) {
    await markEventProcessed(event.id, "noop_duplicate");
    return "noop";
  }

  try {
    const payload = {
      eventId: event.id,
      eventType: event.event_type,
      entityType: event.entity_type,
      entityId: event.entity_id,
      userId: event.user_id,
      blueprintId: event.blueprint_id,
      payload: event.payload,
    };

    if (logContext === "cron") {
      const taskQueue = globalThis.__TORGIMA_TASK_QUEUE__;
      if (!taskQueue) {
        await releaseClaimedEventToRetry(event, "NO_TASK_QUEUE");
        return "failed";
      }
      await taskQueue.send({ queue: queueName, payload });
    } else {
      const boss = await getBoss();
      await boss.send(queueName, payload);
    }

    if (logContext === "cron") {
      logger.info(
        { eventId: event.id, eventType: event.event_type, queue: queueName },
        "[EventDispatcher] Cron event enqueued",
      );
    }
    return "enqueued";
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      { eventId: event.id, eventType: event.event_type, error: errMsg },
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
    return "failed";
  }
}

/**
 * Cloudflare cron path: claim bounded batch, enqueue via TASK_QUEUE only.
 * Never runs inline worker handlers (avoids Worker subrequest exhaustion).
 */
export async function dispatchPendingEventsForCron(): Promise<number> {
  if (!isEventDispatchCronEnabled()) {
    logger.info("[EventDispatcher] Cron exit early — EVENT_DISPATCH_CRON_ENABLED is off");
    return 0;
  }

  const startedAt = Date.now();
  const limit = getCronDispatchBatchSize();
  logger.info(
    {
      limit,
      subrequestSafe: true,
      maxProcessingMs: MAX_PROCESSING_MS,
      maxSubrequestsSafe: MAX_SUBREQUESTS_PER_CRON_SAFE_LIMIT,
    },
    "[EventDispatcher] Cron subrequest-safe mode started",
  );

  let enqueued = 0;
  const pendingEvents = await claimPendingEvents(limit);

  for (const event of pendingEvents) {
    if (Date.now() - startedAt >= MAX_PROCESSING_MS) {
      await releaseClaimedEventToRetry(event, "TIME_LIMIT");
      continue;
    }

    const result = await enqueueClaimedEvent(event, "cron");
    if (result === "enqueued") enqueued++;
  }

  logger.info({ enqueued, claimed: pendingEvents.length }, "[EventDispatcher] Cron batch completed");
  return enqueued;
}

/** API / Node poll path — inline queue fallback when WORKERS_TEST_MODE or no TASK_QUEUE. */
export async function dispatchPendingEvents(
  batchSize?: number,
  options: DispatchPendingOptions = {},
): Promise<number> {
  const limit = resolveBatchSize(batchSize);
  const logContext = options.logContext ?? "default";
  const startedAt = Date.now();

  const pendingEvents = await claimPendingEvents(limit);

  if (pendingEvents.length === 0) {
    if (logContext === "cron") {
      logger.info("[EventDispatcher] Skipped — no pending event");
    }
    return 0;
  }

  let dispatched = 0;

  for (const event of pendingEvents) {
    if (Date.now() - startedAt >= MAX_PROCESSING_MS) {
      await releaseClaimedEventToRetry(event, "TIME_LIMIT");
      break;
    }

    logger.info(
      { eventId: event.id, eventType: event.event_type },
      "[EventDispatcher] Claimed event",
    );

    const result = await enqueueClaimedEvent(event, logContext);
    if (result === "enqueued") dispatched++;
  }

  return dispatched;
}

export async function getEventSystemHealth(): Promise<{
  pending_events: number;
  unresolved_dead_letters: number;
  worker_count: number;
}> {
  const pendingResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM events WHERE status = '${EventStatus.PENDING}'`,
  );
  const dlResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM dead_letter_events WHERE resolved = false",
  );
  const { listDoc16Workers } = await import("../workers/WorkerRegistry.js");
  return {
    pending_events: parseInt(pendingResult.rows[0]?.count ?? "0", 10),
    unresolved_dead_letters: parseInt(dlResult.rows[0]?.count ?? "0", 10),
    worker_count: listDoc16Workers().length,
  };
}

async function markEventProcessed(eventId: string, result: "success" | "noop_duplicate"): Promise<void> {
  await db.update(events).set({ status: EventStatus.PROCESSED }).where(eq(events.id, eventId)).catch(() => null);
  await db
    .insert(eventLogs)
    .values({ event_id: eventId, result, processed_at: new Date() })
    .catch(() => null);
}
