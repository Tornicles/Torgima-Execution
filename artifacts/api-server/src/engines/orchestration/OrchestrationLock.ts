import { db, events } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { EventTypes } from "../../types/eventContracts.js";

const DEFAULT_TTL_MS = 30_000;

export function blueprintLockKey(blueprintId: string, workflowName: string): string {
  return `lock:blueprint:${blueprintId}:${workflowName}`;
}

/** Acquire a blueprint-scoped workflow lock (GAP G1 / DOC_28). */
export async function acquireBlueprintLock(
  blueprintId: string,
  workflowName: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<boolean> {
  const lockKey = blueprintLockKey(blueprintId, workflowName);
  const expiresAt = new Date(Date.now() + ttlMs);

  const [inserted] = await db
    .insert(events)
    .values({
      event_type:      EventTypes.ORCHESTRATION_LOCK,
      entity_type:     "blueprint",
      entity_id:       blueprintId,
      blueprint_id:    blueprintId,
      idempotency_key: lockKey,
      payload:         { workflowName, expires_at: expiresAt.toISOString(), scope: "BLUEPRINT" },
      process_after:   expiresAt,
      status:          "claimed",
    })
    .onConflictDoNothing({ target: events.idempotency_key })
    .returning({ id: events.id });

  return !!inserted;
}

export async function releaseBlueprintLock(
  blueprintId: string,
  workflowName: string,
): Promise<void> {
  const lockKey = blueprintLockKey(blueprintId, workflowName);
  try {
    await db
      .update(events)
      .set({ status: "processed" })
      .where(and(eq(events.idempotency_key, lockKey), eq(events.status, "claimed")));
  } catch (err) {
    logger.debug({ err }, "[OrchestrationLock] release failed");
  }
}
