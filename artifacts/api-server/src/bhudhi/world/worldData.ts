import {
  db,
  bhudhiWorldEntities,
  bhudhiWorldStates,
  bhudhiWorldRelationships,
  bhudhiWorldEvents,
  bhudhiWorldSnapshots,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { WorldEntity, WorldOutput, WorldRelationship, WorldState } from "./contracts/types.js";

export async function persistWorldSession(
  output: WorldOutput,
  input: { blueprintId: string; userId?: string },
): Promise<void> {
  const ws = output.worldState;

  for (const e of ws.entities) {
    await db.insert(bhudhiWorldEntities).values({
      id: e.entityId,
      blueprint_id: input.blueprintId,
      entity_type: e.type,
      label: e.label,
      state: e.state,
      relationships: e.relationships,
      history: e.history,
    });
  }

  for (const r of ws.relationships) {
    await db.insert(bhudhiWorldRelationships).values({
      blueprint_id: input.blueprintId,
      from_entity_id: r.fromEntityId,
      to_entity_id: r.toEntityId,
      relation_type: r.type,
      weight: r.weight,
    });
  }

  for (const ev of ws.events) {
    await db.insert(bhudhiWorldEvents).values({
      blueprint_id: input.blueprintId,
      event_type: ev.type,
      entity_id: null,
      cause: ev.cause ?? null,
      impact: ev.impact,
      confidence: output.confidence,
      payload: {},
    });
  }

  await db.insert(bhudhiWorldSnapshots).values({
    blueprint_id: input.blueprintId,
    version: ws.version,
    world_state: ws as unknown as Record<string, unknown>,
    confidence: output.confidence,
    changes: output.changes,
  });
}

export async function persistEntityState(
  blueprintId: string,
  entityId: string,
  delta: { before: Record<string, unknown>; after: Record<string, unknown>; delta: Record<string, unknown> },
  stateType: string,
): Promise<void> {
  await db.insert(bhudhiWorldStates).values({
    blueprint_id: blueprintId,
    entity_id: entityId,
    state_type: stateType,
    before_state: delta.before,
    after_state: delta.after,
    delta: delta.delta,
  });
}

export async function listWorldSnapshots(blueprintId: string, limit = 10) {
  const rows = await db
    .select()
    .from(bhudhiWorldSnapshots)
    .where(eq(bhudhiWorldSnapshots.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiWorldSnapshots.version))
    .limit(limit);

  return rows.map((r) => ({
    snapshotId: r.id,
    version: r.version,
    confidence: r.confidence,
    changes: r.changes as string[],
    createdAt: r.created_at,
  }));
}

export async function listWorldEntities(blueprintId: string, limit = 50) {
  const rows = await db
    .select()
    .from(bhudhiWorldEntities)
    .where(eq(bhudhiWorldEntities.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiWorldEntities.updated_at))
    .limit(limit);

  return rows.map((r) => ({
    entityId: r.id,
    type: r.entity_type,
    label: r.label,
    state: r.state,
    relationships: r.relationships,
  }));
}

export function rowToEntity(row: typeof bhudhiWorldEntities.$inferSelect): WorldEntity {
  return {
    entityId: row.id,
    type: row.entity_type as WorldEntity["type"],
    label: row.label,
    state: row.state as Record<string, unknown>,
    relationships: (row.relationships as string[]) ?? [],
    history: (row.history as WorldEntity["history"]) ?? [],
  };
}
