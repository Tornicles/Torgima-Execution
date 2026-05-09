import { db } from "@workspace/db";
import { events, eventLogs, deadLetterEvents } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export interface WorkerJobData {
  eventId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  blueprintId?: string;
  payload: Record<string, unknown>;
}

export interface WorkerResult {
  success: boolean;
  retryable?: boolean;
  reason?: string;
}

// Standard worker handler — handles idempotency, logging, retry, and dead-letter
export async function handleWorkerJob(
  job: { id: string | number; data: unknown },
  workerName: string,
  handler: (data: WorkerJobData) => Promise<WorkerResult>,
): Promise<void> {
  const data = job.data as WorkerJobData;
  const startedAt = new Date();

  logger.info(
    { eventId: data.eventId, eventType: data.eventType, blueprintId: data.blueprintId },
    `[${workerName}] Processing`,
  );

  try {
    // Idempotency check: has this event already been successfully processed?
    const [prevSuccess] = await db
      .select({ id: eventLogs.id })
      .from(eventLogs)
      .where(and(eq(eventLogs.event_id, data.eventId), eq(eventLogs.result, "success")))
      .limit(1);

    if (prevSuccess) {
      logger.info({ eventId: data.eventId }, `[${workerName}] Noop duplicate`);
      await writeEventLog(data.eventId, workerName, "noop_duplicate", startedAt);
      await db
        .update(events)
        .set({ status: "processed" })
        .where(eq(events.id, data.eventId))
        .catch(() => null);
      return;
    }

    const result = await handler(data);

    if (result.success) {
      await db
        .update(events)
        .set({ status: "processed" })
        .where(eq(events.id, data.eventId))
        .catch(() => null);
      await writeEventLog(data.eventId, workerName, "success", startedAt);
      logger.info({ eventId: data.eventId }, `[${workerName}] Completed`);
    } else {
      await handleFailure(data, workerName, startedAt, result);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ eventId: data.eventId, error: errMsg }, `[${workerName}] Error`);
    await handleFailure(data, workerName, startedAt, {
      success: false,
      retryable: true,
      reason: errMsg,
    });
    throw err; // Re-throw so pg-boss applies retry policy
  }
}

async function handleFailure(
  data: WorkerJobData,
  workerName: string,
  startedAt: Date,
  result: WorkerResult,
): Promise<void> {
  const [event] = await db
    .select({
      retryCount: events.retry_count,
      maxRetries: events.max_retries,
      eventType: events.event_type,
      payload: events.payload,
    })
    .from(events)
    .where(eq(events.id, data.eventId))
    .limit(1);

  if (!event) return;

  const nextRetryCount = event.retryCount + 1;

  if (!result.retryable || nextRetryCount > event.maxRetries) {
    // Dead-letter
    await db
      .update(events)
      .set({ status: "dead_lettered", retry_count: nextRetryCount })
      .where(eq(events.id, data.eventId))
      .catch(() => null);

    await db
      .insert(deadLetterEvents)
      .values({
        original_event_id: data.eventId,
        event_type: event.eventType,
        ...(data.blueprintId ? { blueprint_id: data.blueprintId } : {}),
        ...(data.userId ? { user_id: data.userId } : {}),
        payload: (event.payload as Record<string, unknown>) ?? {},
        failure_reason: result.reason ?? "Unknown failure",
        retry_count: nextRetryCount,
        last_error: result.reason,
      })
      .catch(() => null);

    await writeEventLog(data.eventId, workerName, "dead_lettered", startedAt, result.reason);
    logger.error(
      { eventId: data.eventId, reason: result.reason },
      `[${workerName}] Dead-lettered`,
    );
  } else {
    // Retry
    await db
      .update(events)
      .set({ status: "retry_pending", retry_count: nextRetryCount })
      .where(eq(events.id, data.eventId))
      .catch(() => null);
    await writeEventLog(data.eventId, workerName, "retry", startedAt, result.reason);
  }
}

async function writeEventLog(
  eventId: string,
  worker: string,
  result: "success" | "retry" | "failed" | "dead_lettered" | "noop_duplicate",
  startedAt: Date,
  errorMessage?: string,
): Promise<void> {
  const finishedAt = new Date();
  await db
    .insert(eventLogs)
    .values({
      event_id: eventId,
      worker,
      result,
      error_message: errorMessage,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      processed_at: finishedAt,
    })
    .catch(() => null);
}
