import { db } from "@workspace/db";
import { events } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { EventStatus } from "@workspace/state-machine";
import { getMaxAttempts } from "../engines/events/RetryPolicy.js";
import { resolveIdempotencyKey } from "../engines/events/Idempotency.js";

// ── EVENT TYPES (GAP G1 — re-export from eventContracts) ─────────────────────

export { EventTypes as EVENT_TYPES, type EventType } from "../types/eventContracts.js";
export { buildEventIdempotencyKey, resolveIdempotencyKey } from "../engines/events/Idempotency.js";
import type { EventType } from "../types/eventContracts.js";

export interface CreateEventInput {
  eventType: EventType;
  entityType: string;
  entityId?: string;
  userId?: string;
  blueprintId?: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  causationEventId?: string;
  processAfter?: Date;
}

// Write an event to the outbox. Call inside a transaction alongside state mutation.
export async function writeEvent(
  input: CreateEventInput,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const client = tx ?? db;

  const basePayload = (input.payload ?? {}) as Record<string, unknown>;
  const payloadMerged: Record<string, unknown> = {
    ...basePayload,
    ...(input.causationEventId ? { causation_event_id: input.causationEventId } : {}),
  };

  const idempotencyKey = resolveIdempotencyKey(input);
  const row: InferInsertModel<typeof events> = {
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    user_id: input.userId,
    blueprint_id: input.blueprintId,
    payload: payloadMerged,
    idempotency_key: idempotencyKey,
    max_retries: getMaxAttempts(input.eventType),
    process_after: input.processAfter ?? new Date(),
    status: EventStatus.PENDING,
  };

  const [inserted] = await (client as typeof db)
    .insert(events)
    .values(row)
    .returning({ id: events.id });

  if (!inserted) throw new Error("Failed to write event to outbox");

  logger.debug(
    { eventId: inserted.id, eventType: input.eventType, blueprintId: input.blueprintId },
    "[EventService] Event written to outbox",
  );

  return inserted.id;
}

/** Idempotent event emit — duplicate idempotency_key returns existing event id. */
export async function emitEvent(
  params: CreateEventInput & { idempotencyKey: string },
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const client = tx ?? db;
  const [inserted] = await (client as typeof db)
    .insert(events)
    .values({
      event_type: params.eventType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      payload: params.payload ?? {},
      idempotency_key: params.idempotencyKey,
      max_retries: getMaxAttempts(params.eventType),
      process_after: params.processAfter ?? new Date(),
      status: EventStatus.PENDING,
    })
    .onConflictDoNothing({ target: events.idempotency_key })
    .returning({ id: events.id });

  if (inserted?.id) return inserted.id;

  const [existing] = await client
    .select({ id: events.id })
    .from(events)
    .where(eq(events.idempotency_key, params.idempotencyKey))
    .limit(1);

  if (!existing) throw new Error("Failed to emit event");
  return existing.id;
}

export async function writeEventInTx(
  input: CreateEventInput,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const basePayload = (input.payload ?? {}) as Record<string, unknown>;
  const payloadMerged: Record<string, unknown> = {
    ...basePayload,
    ...(input.causationEventId ? { causation_event_id: input.causationEventId } : {}),
  };

  const idempotencyKey = resolveIdempotencyKey(input);
  const [inserted] = await tx
    .insert(events)
    .values({
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      payload: payloadMerged,
      idempotency_key: idempotencyKey,
      max_retries: getMaxAttempts(input.eventType),
      process_after: input.processAfter ?? new Date(),
      status: EventStatus.PENDING,
    })
    .returning({ id: events.id });

  if (!inserted) throw new Error("Failed to write event to outbox");

  logger.debug(
    { eventId: inserted.id, eventType: input.eventType, blueprintId: input.blueprintId },
    "[EventService] Event written to outbox (tx)",
  );

  return inserted.id;
}
