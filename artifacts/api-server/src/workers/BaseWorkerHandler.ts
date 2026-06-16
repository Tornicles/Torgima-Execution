import { db } from "@workspace/db";
import { events, eventLogs } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { logger } from "../lib/logger.js";
import { handleWorkerFailure } from "./WorkerDispatcher.js";

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

// Standard worker handler — idempotency, logging, retry (DOC16), and dead-letter
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
        .set({ status: EventStatus.PROCESSED })
        .where(eq(events.id, data.eventId))
        .catch(() => null);
      return;
    }

    const result = await handler(data);

    if (result.success) {
      await db
        .update(events)
        .set({ status: EventStatus.PROCESSED, processed_at: new Date() })
        .where(eq(events.id, data.eventId))
        .catch(() => null);
      await writeEventLog(data.eventId, workerName, "success", startedAt);
      logger.info({ eventId: data.eventId }, `[${workerName}] Completed`);
    } else {
      await handleWorkerFailure({
        eventId: data.eventId,
        eventType: data.eventType,
        workerName,
        retryable: result.retryable !== false,
        reason: result.reason,
        startedAt,
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ eventId: data.eventId, error: errMsg }, `[${workerName}] Error`);
    await handleWorkerFailure({
      eventId: data.eventId,
      eventType: data.eventType,
      workerName,
      retryable: true,
      reason: errMsg,
      startedAt,
    });
    throw err;
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
