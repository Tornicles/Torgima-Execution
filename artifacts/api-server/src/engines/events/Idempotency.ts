/**
 * GAP G2 — idempotency key builders (LAW 1).
 */

import { logger } from "../../lib/logger.js";

/** Stable key: event_type + entity_id (dedupes replays for same entity). */
export function buildEventIdempotencyKey(
  eventType: string,
  entityId: string,
  timeBucketMs?: number,
): string {
  if (timeBucketMs && timeBucketMs > 0) {
    return `${eventType}:${entityId}:${Math.floor(Date.now() / timeBucketMs)}`;
  }
  return `${eventType}:${entityId}`;
}

/** Resolve key for outbox writes — never omit idempotency (LAW 1). */
export function resolveIdempotencyKey(input: {
  eventType: string;
  entityId?: string;
  blueprintId?: string;
  idempotencyKey?: string;
}): string {
  if (input.idempotencyKey) return input.idempotencyKey;

  const entityId = input.entityId ?? input.blueprintId;
  if (entityId) {
    const key = buildEventIdempotencyKey(input.eventType, entityId);
    logger.debug(
      { eventType: input.eventType, key },
      "[Idempotency] Auto-generated idempotency_key",
    );
    return key;
  }

  throw new Error(
    `[EventService] idempotency_key required for ${input.eventType} (provide entityId or idempotencyKey)`,
  );
}
