/**
 * DOC16 — worker dispatch, retry orchestration, and health snapshot.
 */

import { db, events, eventLogs, deadLetterEvents } from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { EVENT_QUEUE_MAP } from "../types/eventContracts.js";
import {
  getWorkerByName,
  getWorkerForEventType,
  WORKER_REGISTRY,
  type Doc16WorkerDefinition,
} from "./WorkerRegistry.js";
import {
  getMaxRetriesForPolicy,
  getNextRunAfterForPolicy,
  shouldDeadLetter,
  type RetryPolicyName,
} from "./RetryPolicy.js";
import { moveEventToDeadLetter } from "./DeadLetterHandler.js";
import { logger } from "../lib/logger.js";

export function resolveWorkerForEvent(eventType: string): Doc16WorkerDefinition | undefined {
  return getWorkerForEventType(eventType);
}

export function resolveQueueForEvent(eventType: string): string | undefined {
  return EVENT_QUEUE_MAP[eventType];
}

export interface WorkerFailureParams {
  eventId: string;
  eventType: string;
  workerName: string;
  retryable: boolean;
  reason?: string;
  startedAt: Date;
}

/** DOC16 retry / dead-letter orchestration for worker handlers. */
export async function handleWorkerFailure(params: WorkerFailureParams): Promise<"retry" | "dead_letter"> {
  const [event] = await db
    .select({
      retryCount: events.retry_count,
      eventType: events.event_type,
    })
    .from(events)
    .where(eq(events.id, params.eventId))
    .limit(1);

  if (!event) return "dead_letter";

  const workerDef = getWorkerByName(params.workerName);
  const policy: RetryPolicyName = workerDef?.retryPolicy ?? "STANDARD";
  const nextRetryCount = event.retryCount + 1;

  if (!params.retryable || shouldDeadLetter(policy, nextRetryCount)) {
    await db
      .update(events)
      .set({ retry_count: nextRetryCount })
      .where(eq(events.id, params.eventId))
      .catch(() => null);

    await moveEventToDeadLetter({
      eventId: params.eventId,
      reason: params.reason ?? "Unknown failure",
      lastError: params.reason ?? "Unknown failure",
      failureClass: params.retryable === false ? "permanent" : "transient",
      workerName: params.workerName,
      startedAt: params.startedAt,
    });

    logger.error(
      { eventId: params.eventId, worker: params.workerName, policy },
      "[WorkerDispatcher] Event dead-lettered",
    );
    return "dead_letter";
  }

  const processAfter = getNextRunAfterForPolicy(policy, event.retryCount);
  await db
    .update(events)
    .set({
      status: EventStatus.RETRY_PENDING,
      retry_count: nextRetryCount,
      process_after: processAfter,
    })
    .where(eq(events.id, params.eventId))
    .catch(() => null);

  await db
    .insert(eventLogs)
    .values({
      event_id: params.eventId,
      worker: params.workerName,
      result: "retry",
      error_message: params.reason,
      duration_ms: Date.now() - params.startedAt.getTime(),
      processed_at: new Date(),
    })
    .catch(() => null);

  return "retry";
}

export function getWorkerHealthSnapshot(): Array<{
  name: string;
  consumes: string[];
  produces: string[];
  retryPolicy: RetryPolicyName;
  timeoutMs: number;
  lockScope: Doc16WorkerDefinition["lockScope"];
  queue?: string;
  maxRetries: number;
}> {
  return Object.values(WORKER_REGISTRY).map((worker) => ({
    name: worker.name,
    consumes: [...worker.consumes],
    produces: [...worker.produces],
    retryPolicy: worker.retryPolicy,
    timeoutMs: worker.timeoutMs,
    lockScope: worker.lockScope,
    queue: worker.queue,
    maxRetries: getMaxRetriesForPolicy(worker.retryPolicy),
  }));
}

/** Aggregate worker + outbox health for internal monitoring routes. */
export async function getWorkerMonitoringHealth(): Promise<{
  workers: ReturnType<typeof getWorkerHealthSnapshot>;
  pending_events: number;
  retry_pending_events: number;
  dead_lettered_events: number;
  unresolved_dead_letters: number;
  recent_failures_24h: number;
}> {
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.status, EventStatus.PENDING));
  const [{ retryPending }] = await db
    .select({ retryPending: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.status, EventStatus.RETRY_PENDING));
  const [{ deadLettered }] = await db
    .select({ deadLettered: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.status, EventStatus.DEAD_LETTERED));
  const [{ unresolvedDlq }] = await db
    .select({ unresolvedDlq: sql<number>`count(*)::int` })
    .from(deadLetterEvents)
    .where(eq(deadLetterEvents.resolved, false));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ recentFailures }] = await db
    .select({ recentFailures: sql<number>`count(*)::int` })
    .from(eventLogs)
    .where(
      and(
        gte(eventLogs.processed_at, since),
        sql`${eventLogs.result} in ('failed', 'dead_lettered', 'retry')`,
      ),
    );

  return {
    workers: getWorkerHealthSnapshot(),
    pending_events: pending ?? 0,
    retry_pending_events: retryPending ?? 0,
    dead_lettered_events: deadLettered ?? 0,
    unresolved_dead_letters: unresolvedDlq ?? 0,
    recent_failures_24h: recentFailures ?? 0,
  };
}
