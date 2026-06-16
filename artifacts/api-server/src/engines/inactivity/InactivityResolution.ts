import { db, inactivityRecords } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

/** DOC 11 — resolve open inactivity records when user submits feedback. */
export async function resolveInactivityOnFeedback(
  userId: string,
  blueprintId: string,
): Promise<number> {
  const updated = await db
    .update(inactivityRecords)
    .set({
      resolved: true,
      resolved_at: new Date(),
      response_triggered: "returned_to_execution",
    })
    .where(
      and(
        eq(inactivityRecords.user_id, userId),
        eq(inactivityRecords.blueprint_id, blueprintId),
        eq(inactivityRecords.resolved, false),
      ),
    )
    .returning({ id: inactivityRecords.id });

  for (const row of updated) {
    await writeEvent({
      eventType: EVENT_TYPES.INACTIVITY_RESOLVED,
      entityType: "blueprint",
      entityId: blueprintId,
      userId,
      blueprintId,
      payload: {
        inactivity_record_id: row.id,
        resolution_type: "returned_to_execution",
      },
      idempotencyKey: `inactivity_resolved:${row.id}`,
    }).catch(() => null);

    await writeEvent({
      eventType: EVENT_TYPES.IDENTITY_EVALUATION_REQUESTED,
      entityType: "blueprint",
      entityId: blueprintId,
      userId,
      blueprintId,
      payload: { reason: "inactivity_resolved", inactivity_record_id: row.id },
      idempotencyKey: `identity:inactivity_resolved:${row.id}`,
    }).catch(() => null);

    await writeEvent({
      eventType: EVENT_TYPES.REWARD_EVALUATION_REQUESTED,
      entityType: "inactivity",
      entityId: row.id,
      userId,
      blueprintId,
      payload: {
        source_type: "INACTIVITY",
        source_id: row.id,
        idempotency_key: `reward:inactivity:${row.id}`,
      },
      idempotencyKey: `reward:inactivity:${row.id}`,
    }).catch(() => null);
  }

  return updated.length;
}

export async function resolveInactivityRecord(recordId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .update(inactivityRecords)
    .set({
      resolved: true,
      resolved_at: new Date(),
      response_triggered: "returned_to_execution",
    })
    .where(and(eq(inactivityRecords.id, recordId), eq(inactivityRecords.user_id, userId)))
    .returning({ id: inactivityRecords.id, blueprint_id: inactivityRecords.blueprint_id });

  if (!row) return false;

  await writeEvent({
    eventType: EVENT_TYPES.INACTIVITY_RESOLVED,
    entityType: "blueprint",
    entityId: row.blueprint_id,
    userId,
    blueprintId: row.blueprint_id,
    payload: {
      inactivity_record_id: row.id,
      resolution_type: "returned_to_execution",
    },
    idempotencyKey: `inactivity_resolved:${row.id}`,
  }).catch(() => null);

  await writeEvent({
    eventType: EVENT_TYPES.IDENTITY_EVALUATION_REQUESTED,
    entityType: "blueprint",
    entityId: row.blueprint_id,
    userId,
    blueprintId: row.blueprint_id,
    payload: { reason: "inactivity_resolved", inactivity_record_id: row.id },
    idempotencyKey: `identity:inactivity_resolved:${row.id}`,
  }).catch(() => null);

  await writeEvent({
    eventType: EVENT_TYPES.REWARD_EVALUATION_REQUESTED,
    entityType: "inactivity",
    entityId: row.id,
    userId,
    blueprintId: row.blueprint_id,
    payload: {
      source_type: "INACTIVITY",
      source_id: row.id,
      idempotency_key: `reward:inactivity:${row.id}`,
    },
    idempotencyKey: `reward:inactivity:${row.id}`,
  }).catch(() => null);

  return true;
}
