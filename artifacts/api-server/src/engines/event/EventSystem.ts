/**
 * Prompt 8 — central event bus facade over outbox `events` + `idempotency_records`.
 * LAW 1: events carry payloads; engines calculate signals/conditions — never inline here.
 * LAW 2: DLQ retries reuse original payload; no mutation retries.
 */
import { db, events, idempotencyRecords, deadLetterEvents } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import {
  writeEvent,
  emitEvent as emitOutboxEvent,
  EVENT_TYPES,
  type CreateEventInput,
} from "../../services/EventService.js";

export { EVENT_TYPES };

/** Prompt 8 dotted aliases mapped to internal outbox types (audit / docs). */
export const PHASE8_EVENT_ALIASES = {
  "execution.feedback.submitted": EVENT_TYPES.FEEDBACK_SUBMITTED,
  "execution.order.completed": EVENT_TYPES.ORDER_AVAILABLE,
  "signal.calculated": EVENT_TYPES.SIGNAL_CALCULATED,
  "condition.assigned": EVENT_TYPES.CONDITION_EVALUATED,
  "condition.changed": EVENT_TYPES.STATE_CHANGED,
  "system.overnight.complete": EVENT_TYPES.OVERNIGHT_COMPLETE,
  "system.health.alert": EVENT_TYPES.HEALTH_ALERT,
  "system.dlq.item.created": EVENT_TYPES.DLQ_ITEM_CREATED,
  "psychology.burnout.detected": EVENT_TYPES.BURNOUT_RISK_DETECTED,
  "user.inactivity.detected": EVENT_TYPES.INACTIVITY_DETECTED,
} as const;

export type EventPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface EmitEventInput {
  eventType: string;
  sourceEngine: string;
  userId?: string;
  blueprintId?: string;
  orderId?: string;
  payload: Record<string, unknown>;
  priority?: EventPriority;
  idempotencyKey: string;
  entityType?: string;
  entityId?: string;
  processAfter?: Date;
  ttlHours?: number;
}

export interface EmitEventResult {
  eventId: string;
  duplicate: boolean;
  cachedResult?: Record<string, unknown>;
}

function resolveEventType(eventType: string): CreateEventInput["eventType"] {
  const alias = PHASE8_EVENT_ALIASES[eventType as keyof typeof PHASE8_EVENT_ALIASES];
  if (alias) return alias;
  const values = Object.values(EVENT_TYPES) as string[];
  if (values.includes(eventType)) return eventType as CreateEventInput["eventType"];
  throw new Error(`[EventSystem] Unknown event type: ${eventType}`);
}

function defaultExpiresAt(ttlHours?: number): Date {
  const hours = ttlHours ?? 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** Idempotent emit — duplicate key returns stored result without re-queueing. */
export async function emitEvent(input: EmitEventInput): Promise<EmitEventResult> {
  const [existing] = await db
    .select()
    .from(idempotencyRecords)
    .where(eq(idempotencyRecords.key, input.idempotencyKey))
    .limit(1);

  if (existing?.result && existing.event_id) {
    return {
      eventId: existing.event_id,
      duplicate: true,
      cachedResult: existing.result as Record<string, unknown>,
    };
  }

  const eventType = resolveEventType(input.eventType);
  const entityType = input.entityType ?? (input.blueprintId ? "blueprint" : "system");
  const entityId = input.entityId ?? input.blueprintId ?? input.orderId ?? input.userId;

  const payload: Record<string, unknown> = {
    ...input.payload,
    source_engine: input.sourceEngine,
    priority: input.priority ?? "NORMAL",
    ...(input.orderId ? { order_id: input.orderId } : {}),
  };

  const eventId = await emitOutboxEvent({
    eventType,
    entityType,
    entityId,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload,
    idempotencyKey: input.idempotencyKey,
    processAfter: input.processAfter,
  });

  await db
    .insert(idempotencyRecords)
    .values({
      key: input.idempotencyKey,
      event_id: eventId,
      expires_at: defaultExpiresAt(input.ttlHours),
    })
    .onConflictDoNothing({ target: idempotencyRecords.key });

  return { eventId, duplicate: false };
}

export async function storeIdempotencyResult(
  key: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .update(idempotencyRecords)
    .set({ result })
    .where(eq(idempotencyRecords.key, key));
}

export async function cleanExpiredIdempotencyRecords(): Promise<number> {
  const deleted = await db
    .delete(idempotencyRecords)
    .where(lt(idempotencyRecords.expires_at, new Date()))
    .returning({ id: idempotencyRecords.id });
  return deleted.length;
}

/** Review DLQ — safe retries only; signal-mutation payloads flagged manual. */
export async function handleDLQ(dlqItemId?: string): Promise<{ reviewed: number; alerted: boolean }> {
  const open = await db
    .select()
    .from(deadLetterEvents)
    .where(
      dlqItemId
        ? and(eq(deadLetterEvents.id, dlqItemId), eq(deadLetterEvents.resolved, false))
        : eq(deadLetterEvents.resolved, false),
    )
    .limit(50);

  let reviewed = 0;
  const now = Date.now();

  for (const item of open) {
    reviewed++;
    const ageMs = now - item.created_at.getTime();
    const payload = (item.payload ?? {}) as Record<string, unknown>;

    if (payload["mutate_signal"] === true || payload["force_signal_recalc"] === true) {
      await db
        .update(deadLetterEvents)
        .set({ resolution_status: "REQUIRES_MANUAL" })
        .where(eq(deadLetterEvents.id, item.id));
      continue;
    }

    if (ageMs > 48 * 60 * 60 * 1000) {
      await db
        .update(deadLetterEvents)
        .set({ resolution_status: "REQUIRES_MANUAL" })
        .where(eq(deadLetterEvents.id, item.id));
    } else if (ageMs > 24 * 60 * 60 * 1000) {
      await db
        .update(deadLetterEvents)
        .set({ resolution_status: "REQUIRES_MANUAL" })
        .where(eq(deadLetterEvents.id, item.id));
    } else if (item.failure_class === "transient" && item.retry_count < 3) {
      // Safe retry: re-queue original event payload unchanged (LAW 2)
      await writeEvent({
        eventType: item.event_type as CreateEventInput["eventType"],
        entityType: "system",
        entityId: item.original_event_id,
        blueprintId: item.blueprint_id ?? undefined,
        userId: item.user_id ?? undefined,
        payload,
        idempotencyKey: `dlq_retry:${item.id}:${item.retry_count}`,
        processAfter: new Date(Date.now() + 60_000),
      }).catch(() => null);
    }
  }

  const [{ count: dlqSize }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deadLetterEvents)
    .where(eq(deadLetterEvents.resolved, false));

  let alerted = false;
  if ((dlqSize ?? 0) > 10) {
    alerted = true;
    await emitEvent({
      eventType: EVENT_TYPES.HEALTH_ALERT,
      sourceEngine: "dlq_processor",
      payload: { dlqSize, reason: "DLQ_THRESHOLD" },
      idempotencyKey: `health_alert:dlq:${Math.floor(Date.now() / 300000)}`,
      entityType: "system",
      entityId: "dlq",
    }).catch(() => null);
  }

  return { reviewed, alerted };
}

export async function moveEventToDLQ(params: {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  retryCount: number;
  userId?: string;
  blueprintId?: string;
}): Promise<void> {
  const { deadLetterEvent } = await import("../events/DeadLetterHandler.js");
  await db
    .update(events)
    .set({ retry_count: params.retryCount })
    .where(eq(events.id, params.eventId))
    .catch(() => null);
  await deadLetterEvent(params.eventId, params.failureReason, params.failureReason, "transient");

  await emitEvent({
    eventType: EVENT_TYPES.DLQ_ITEM_CREATED,
    sourceEngine: "event_system",
    payload: { originalEventId: params.eventId, failureReason: params.failureReason },
    idempotencyKey: `dlq_created:${params.eventId}`,
    entityType: "system",
    entityId: params.eventId,
  }).catch(() => null);
}
