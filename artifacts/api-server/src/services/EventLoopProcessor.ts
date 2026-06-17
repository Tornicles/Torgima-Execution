/**
 * Event loop drain helpers — test/CI inline processing and bounded production drain.
 */

import { db, pool } from "@workspace/db";
import { events } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { detectStuckEvents } from "../engines/events/StuckEventDetector.js";
import { EVENT_QUEUE_MAP } from "../types/eventContracts.js";
import { listDoc16Workers } from "../workers/WorkerRegistry.js";
import { logger } from "../lib/logger.js";
import {
  dispatchPendingEvents,
  getCronDispatchBatchSize,
  isEventDispatchCronEnabled,
  MAX_PROCESSING_MS,
} from "./EventDispatcher.js";
import { isLaunchMode } from "../lib/launch-mode.js";
import { shouldUseInlineQueueDispatch } from "../lib/queue.js";

export type DrainEventsOptions = {
  batchSize?: number;
  maxBatches?: number;
  allowedEventTypes?: string[];
  maxRuntimeMs?: number;
};

export type DrainEventsResult = {
  batches: number;
  dispatched: number;
  stuckRequeued: number;
  stuckDeadLettered: number;
  remainingPending: number;
  remainingRetryPending: number;
  criticalDeadLetters: number;
};

export type EventLoopSnapshot = {
  pending: number;
  retry_pending: number;
  claimed: number;
  processed_24h: number;
  dead_letter_count: number;
  unresolved_dead_letters: number;
  top_pending_types: Array<{ event_type: string; count: number }>;
  latest_failure_reasons: Array<{ event_type: string; failure_reason: string; created_at: string }>;
  registered_worker_count: number;
  unhandled_event_types: string[];
  batch_size_config: number;
  cron_enabled: boolean;
  launch_mode: boolean;
  inline_dispatch: boolean;
  last_dispatch_hint: string;
};

const CRITICAL_EVENT_TYPES = new Set([
  "feedback_submitted",
  "feedback_submitted_partial",
  "signal_recalculation_requested",
  "signal_calculated",
  "condition_evaluation_requested",
  "condition_evaluated",
  "enforcement_package_created",
  "task_generation_requested",
]);

async function countEventsByStatus(status: (typeof EventStatus)[keyof typeof EventStatus]): Promise<number> {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.status, status));
  return c ?? 0;
}

async function countCriticalDeadLetters(): Promise<number> {
  try {
    const result = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM dead_letter_events
       WHERE resolved = false AND event_type = ANY($1::text[])`,
      [[...CRITICAL_EVENT_TYPES]],
    );
    return Number(result.rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

/** Ensure queue handler side-effects register all worker handlers. */
export async function ensureWorkerHandlersLoaded(): Promise<void> {
  await import("../queues/handler.js");
}

/**
 * Drain pending events in bounded batches (test/CI/debug).
 * Fails when critical events land in dead letter during drain.
 */
export async function drainEventsForTest(
  options: DrainEventsOptions = {},
): Promise<DrainEventsResult> {
  await ensureWorkerHandlersLoaded();
  const result = await drainEventsOnce({
    batchSize: options.batchSize ?? 5,
    maxBatches: options.maxBatches ?? 10,
    allowedEventTypes: options.allowedEventTypes,
    maxRuntimeMs: options.maxRuntimeMs ?? 30_000,
  });

  const criticalDl = await countCriticalDeadLetters();
  if (criticalDl > 0) {
    throw new Error(
      `[EventLoopProcessor] Critical events dead-lettered during test drain (count=${criticalDl})`,
    );
  }
  return result;
}

/** Bounded multi-batch drain — safe for debug endpoints and feedback fast path. */
export async function drainEventsOnce(options: DrainEventsOptions = {}): Promise<DrainEventsResult> {
  await ensureWorkerHandlersLoaded();

  const batchSize = options.batchSize ?? getCronDispatchBatchSize();
  const maxBatches = options.maxBatches ?? 1;
  const maxRuntimeMs = options.maxRuntimeMs ?? MAX_PROCESSING_MS;
  const startedAt = Date.now();

  const stuck = await detectStuckEvents();
  let dispatched = 0;
  let batches = 0;

  for (let i = 0; i < maxBatches; i++) {
    if (Date.now() - startedAt >= maxRuntimeMs) break;

    const count = await dispatchPendingEvents(batchSize);
    dispatched += count;
    batches++;
    if (count === 0) break;
  }

  const [pending, retryPending, criticalDl] = await Promise.all([
    countEventsByStatus(EventStatus.PENDING),
    countEventsByStatus(EventStatus.RETRY_PENDING),
    countCriticalDeadLetters(),
  ]);

  logger.info(
    { dispatched, batches, pending, retryPending, stuck },
    "[EventLoopProcessor] Drain completed",
  );

  return {
    batches,
    dispatched,
    stuckRequeued: stuck.requeued,
    stuckDeadLettered: stuck.deadLettered,
    remainingPending: pending,
    remainingRetryPending: retryPending,
    criticalDeadLetters: criticalDl,
  };
}

export async function getEventLoopSnapshot(): Promise<EventLoopSnapshot> {
  const registered = listDoc16Workers();
  const handled = new Set<string>();
  for (const w of registered) {
    for (const t of w.consumes) handled.add(t);
  }

  let topPending: Array<{ event_type: string; count: number }> = [];
  let latestFailures: Array<{ event_type: string; failure_reason: string; created_at: string }> = [];
  let processed24h = 0;
  let deadLetterCount = 0;
  let unresolvedDl = 0;

  try {
    const top = await pool.query<{ event_type: string; count: string }>(
      `SELECT event_type, COUNT(*)::text AS count FROM events
       WHERE status IN ('pending', 'retry_pending', 'claimed')
       GROUP BY event_type ORDER BY count DESC LIMIT 10`,
    );
    topPending = top.rows.map((r) => ({
      event_type: r.event_type,
      count: Number(r.count),
    }));

    const failures = await pool.query<{
      event_type: string;
      failure_reason: string;
      created_at: Date;
    }>(
      `SELECT event_type, failure_reason, created_at FROM dead_letter_events
       ORDER BY created_at DESC LIMIT 10`,
    );
    latestFailures = failures.rows.map((r) => ({
      event_type: r.event_type,
      failure_reason: r.failure_reason,
      created_at:
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));

    const p24 = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM events
       WHERE status = 'processed' AND processed_at >= NOW() - INTERVAL '24 hours'`,
    );
    processed24h = Number(p24.rows[0]?.c ?? 0);

    const dl = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM dead_letter_events`);
    deadLetterCount = Number(dl.rows[0]?.c ?? 0);

    const udl = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM dead_letter_events WHERE resolved = false`,
    );
    unresolvedDl = Number(udl.rows[0]?.c ?? 0);
  } catch {
    /* degraded */
  }

  const pendingTypes = new Set(topPending.map((t) => t.event_type));
  const unhandled = [...pendingTypes].filter((t) => !handled.has(t) && !EVENT_QUEUE_MAP[t]);

  const [pending, retryPending, claimed] = await Promise.all([
    countEventsByStatus(EventStatus.PENDING),
    countEventsByStatus(EventStatus.RETRY_PENDING),
    countEventsByStatus(EventStatus.CLAIMED),
  ]);

  return {
    pending,
    retry_pending: retryPending,
    claimed,
    processed_24h: processed24h,
    dead_letter_count: deadLetterCount,
    unresolved_dead_letters: unresolvedDl,
    top_pending_types: topPending,
    latest_failure_reasons: latestFailures,
    registered_worker_count: registered.length,
    unhandled_event_types: unhandled,
    batch_size_config: getCronDispatchBatchSize(),
    cron_enabled: isEventDispatchCronEnabled(),
    launch_mode: isLaunchMode(),
    inline_dispatch: shouldUseInlineQueueDispatch(),
    last_dispatch_hint: "Use POST /api/debug/event-loop/drain-once for bounded manual drain",
  };
}
