/**
 * DOC16 — typed event emitter with built-in idempotency.
 */
import { emitEvent as emitOutboxEvent, writeEvent } from "../../services/EventService.js";
import { resolveIdempotencyKey } from "../../engines/events/Idempotency.js";
import type { EventType } from "../../types/eventContracts.js";

export interface TypedEmitEventParams {
  event_type: EventType | string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  blueprint_id?: string;
  payload?: Record<string, unknown>;
  process_after?: Date;
  /** When omitted, auto-builds `{event_type}:{entity_id}` (stable dedupe). */
  idempotency_key?: string;
  /** DOC16 example format — unique per millisecond when true. */
  useTimestampBucket?: boolean;
}

export interface TypedEmitEventResult {
  eventId: string;
  duplicate: boolean;
}

function resolveEmitKey(params: TypedEmitEventParams): string {
  if (params.idempotency_key?.trim()) return params.idempotency_key.trim();
  if (params.useTimestampBucket) {
    return `${params.event_type}:${params.entity_id}:${Date.now()}`;
  }
  return resolveIdempotencyKey({
    eventType: params.event_type,
    entityId: params.entity_id,
    blueprintId: params.blueprint_id,
  });
}

/** DOC16 Task 3 — idempotent outbox write; duplicates return the existing event id. */
export async function emitEvent(params: TypedEmitEventParams): Promise<TypedEmitEventResult> {
  const idempotencyKey = resolveEmitKey(params);
  const eventType = params.event_type as EventType;

  const eventId = await emitOutboxEvent({
    eventType,
    entityType: params.entity_type,
    entityId: params.entity_id,
    userId: params.user_id,
    blueprintId: params.blueprint_id,
    payload: params.payload,
    processAfter: params.process_after,
    idempotencyKey,
  });

  return { eventId, duplicate: false };
}

/** Transaction-safe emit inside an open tx (uses writeEvent + ON CONFLICT semantics). */
export async function emitEventInTransaction(
  params: TypedEmitEventParams,
  tx: Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0],
): Promise<string> {
  return writeEvent(
    {
      eventType: params.event_type as EventType,
      entityType: params.entity_type,
      entityId: params.entity_id,
      userId: params.user_id,
      blueprintId: params.blueprint_id,
      payload: params.payload,
      processAfter: params.process_after,
      idempotencyKey: resolveEmitKey(params),
    },
    tx,
  );
}

export { resolveIdempotencyKey, buildEventIdempotencyKey } from "../../engines/events/Idempotency.js";
