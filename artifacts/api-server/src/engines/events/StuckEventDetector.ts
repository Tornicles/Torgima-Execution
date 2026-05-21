/**
 * GAP G2 — recover CLAIMED events stuck past SLA (DOC_16).
 *
 * Uses process_after as claim deadline: dispatcher sets process_after = now + SLA
 * when moving to CLAIMED; if still CLAIMED after that instant, the worker never finished.
 */

import { db, events } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { getMaxAttempts, getNextRunAfter } from "./RetryPolicy.js";
import { deadLetterEvent } from "./DeadLetterHandler.js";

/** 2× expected ~30s processing (GAP G2). */
export const STUCK_CLAIMED_THRESHOLD_MS = 60_000;

export function claimDeadlineFromNow(now = Date.now()): Date {
  return new Date(now + STUCK_CLAIMED_THRESHOLD_MS);
}

export interface StuckEventRecoveryResult {
  requeued: number;
  deadLettered: number;
}

export async function detectStuckEvents(): Promise<StuckEventRecoveryResult> {
  const now = new Date();

  const stuck = await db
    .select({
      id: events.id,
      event_type: events.event_type,
      retry_count: events.retry_count,
      max_retries: events.max_retries,
    })
    .from(events)
    .where(
      and(eq(events.status, EventStatus.CLAIMED), lte(events.process_after, now)),
    )
    .limit(100);

  let requeued = 0;
  let deadLettered = 0;

  for (const event of stuck) {
    const maxAttempts = event.max_retries ?? getMaxAttempts(event.event_type);
    if (event.retry_count >= maxAttempts) {
      await deadLetterEvent(
        event.id,
        "stuck_claimed_exceeded_max_attempts",
        "Worker crashed or timed out while event was CLAIMED",
      );
      deadLettered++;
    } else {
      const nextRetry = event.retry_count + 1;
      await db
        .update(events)
        .set({
          status: EventStatus.RETRY_PENDING,
          retry_count: nextRetry,
          process_after: getNextRunAfter(event.event_type, event.retry_count),
        })
        .where(eq(events.id, event.id));
      requeued++;
    }
  }

  if (requeued > 0 || deadLettered > 0) {
    logger.warn({ requeued, deadLettered }, "[StuckEventDetector] Recovered stuck CLAIMED events");
  }

  return { requeued, deadLettered };
}

/** Dispatch-ready events: pending or retry_pending whose process_after has elapsed. */
export function dispatchableStatuses(): string[] {
  return [EventStatus.PENDING, EventStatus.RETRY_PENDING];
}
