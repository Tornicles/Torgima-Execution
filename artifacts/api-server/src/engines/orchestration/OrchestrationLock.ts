import { db, events } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { EventTypes } from "../../types/eventContracts.js";
import { writeEvent } from "../../services/EventService.js";
import { deadLetterQueue } from "../../services/DeadLetterQueue.js";

export type LockScope = "USER" | "BLUEPRINT" | "ORDER" | "EVENT_CHAIN" | "NONE";

export const LOCK_MAX_TTL_SECONDS = 30;
export const LOCK_ACQUIRE_WAIT_MS = 5_000;

const DEFAULT_TTL_MS = LOCK_MAX_TTL_SECONDS * 1000;
const POLL_MS = 200;

export function lockKey(scope: LockScope, entityId: string, workflowName?: string): string {
  if (scope === "NONE") return "";
  const suffix = workflowName ? `:${workflowName}` : "";
  return `lock:${scope.toLowerCase()}:${entityId}${suffix}`;
}

/** @deprecated Use lockKey("BLUEPRINT", blueprintId, workflowName) */
export function blueprintLockKey(blueprintId: string, workflowName: string): string {
  return lockKey("BLUEPRINT", blueprintId, workflowName);
}

async function purgeExpiredLocks(): Promise<void> {
  const now = new Date();
  await db
    .update(events)
    .set({ status: "processed" })
    .where(
      and(
        eq(events.event_type, EventTypes.ORCHESTRATION_LOCK),
        eq(events.status, "claimed"),
        lte(events.process_after, now),
      ),
    )
    .catch(() => null);
}

async function tryAcquireOnce(
  scope: LockScope,
  entityId: string,
  ttlMs: number,
  workflowName?: string,
  blueprintId?: string,
): Promise<boolean> {
  if (scope === "NONE") return true;

  const key = lockKey(scope, entityId, workflowName);
  const expiresAt = new Date(Date.now() + Math.min(ttlMs, DEFAULT_TTL_MS));
  const bpId = blueprintId ?? (scope === "BLUEPRINT" ? entityId.split(":")[0] : undefined);

  const [inserted] = await db
    .insert(events)
    .values({
      event_type: EventTypes.ORCHESTRATION_LOCK,
      entity_type: scope.toLowerCase(),
      entity_id: entityId,
      blueprint_id: bpId,
      idempotency_key: key,
      payload: {
        scope,
        entityId,
        workflowName: workflowName ?? null,
        expires_at: expiresAt.toISOString(),
      },
      process_after: expiresAt,
      status: "claimed",
    })
    .onConflictDoNothing({ target: events.idempotency_key })
    .returning({ id: events.id });

  return !!inserted;
}

async function handleLockTimeout(params: {
  scope: LockScope;
  entityId: string;
  workflowName?: string;
  causationEventId?: string;
  userId?: string;
  blueprintId?: string;
}): Promise<void> {
  const key = lockKey(params.scope, params.entityId, params.workflowName);

  await writeEvent({
    eventType: EventTypes.ORCHESTRATION_LOCK_TIMEOUT,
    entityType: params.scope.toLowerCase(),
    entityId: params.entityId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      lock_key: key,
      scope: params.scope,
      workflow: params.workflowName ?? null,
      wait_ms: LOCK_ACQUIRE_WAIT_MS,
    },
    idempotencyKey: `orchestration_lock_timeout:${key}:${Math.floor(Date.now() / 60000)}`,
    causationEventId: params.causationEventId,
  }).catch(() => null);

  if (params.causationEventId) {
    await deadLetterQueue
      .createFromFailedEvent({
        eventId: params.causationEventId,
        reason: `orchestration_lock_timeout:${key}`,
        lastError: `Could not acquire ${params.scope} lock within ${LOCK_ACQUIRE_WAIT_MS}ms`,
        failureClass: "transient",
        dispatchFailures: 3,
      })
      .catch(() => null);
  }

  logger.error(
    { scope: params.scope, entityId: params.entityId, workflow: params.workflowName },
    "[OrchestrationLock] Lock acquire timeout — dead-letter routed",
  );
}

/**
 * Acquire orchestration lock (DOC 28). Waits up to LOCK_ACQUIRE_WAIT_MS, then DLQ on timeout.
 */
export async function acquireLock(
  scope: LockScope,
  entityId: string,
  ttlSeconds = LOCK_MAX_TTL_SECONDS,
  options?: {
    workflowName?: string;
    waitMs?: number;
    causationEventId?: string;
    userId?: string;
    blueprintId?: string;
  },
): Promise<boolean> {
  if (scope === "NONE") return true;

  const ttlMs = Math.min(ttlSeconds, LOCK_MAX_TTL_SECONDS) * 1000;
  const waitMs = options?.waitMs ?? LOCK_ACQUIRE_WAIT_MS;
  const workflowName = options?.workflowName;

  await purgeExpiredLocks();

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const got = await tryAcquireOnce(
      scope,
      entityId,
      ttlMs,
      workflowName,
      options?.blueprintId ?? (scope === "BLUEPRINT" ? entityId : undefined),
    );
    if (got) return true;
    await new Promise((r) => setTimeout(r, POLL_MS));
    await purgeExpiredLocks();
  }

  await handleLockTimeout({
    scope,
    entityId,
    workflowName,
    causationEventId: options?.causationEventId,
    userId: options?.userId,
    blueprintId: options?.blueprintId,
  });
  return false;
}

export async function releaseLock(
  scope: LockScope,
  entityId: string,
  workflowName?: string,
): Promise<void> {
  if (scope === "NONE") return;
  const key = lockKey(scope, entityId, workflowName);
  try {
    await db
      .update(events)
      .set({ status: "processed" })
      .where(and(eq(events.idempotency_key, key), eq(events.status, "claimed")));
  } catch (err) {
    logger.debug({ err }, "[OrchestrationLock] release failed");
  }
}

/** @deprecated Use acquireLock("BLUEPRINT", blueprintId, ttl, { workflowName }) */
export async function acquireBlueprintLock(
  blueprintId: string,
  workflowName: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<boolean> {
  return acquireLock("BLUEPRINT", blueprintId, Math.ceil(ttlMs / 1000), { workflowName });
}

/** @deprecated Use releaseLock("BLUEPRINT", `${blueprintId}:${workflowName}`) */
export async function releaseBlueprintLock(
  blueprintId: string,
  workflowName: string,
): Promise<void> {
  return releaseLock("BLUEPRINT", blueprintId, workflowName);
}
