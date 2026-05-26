import {
  db,
  bhudhiProtocolMessages,
  bhudhiProtocolRoutes,
  bhudhiProtocolContracts,
} from "@workspace/db";
import { and, desc, eq, max } from "drizzle-orm";
import type {
  BhudhiMessage,
  ProtocolMessageStatus,
  ProtocolRouteRecord,
  StoredProtocolMessage,
} from "./contracts/types.js";

function toStoredMessage(row: typeof bhudhiProtocolMessages.$inferSelect): StoredProtocolMessage {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    version: row.version,
    messageType: row.message_type as StoredProtocolMessage["messageType"],
    from: row.from_engine,
    to: row.to_engine,
    uri: row.uri,
    payload: row.payload as Record<string, unknown>,
    routeId: row.route_id,
    sequenceNumber: row.sequence_number,
    status: row.status as StoredProtocolMessage["status"],
    sentAt: row.sent_at,
    processedAt: row.processed_at,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  };
}

function toRouteRecord(row: typeof bhudhiProtocolRoutes.$inferSelect): ProtocolRouteRecord {
  return {
    id: row.id,
    pattern: row.pattern,
    handler: row.handler,
    requestSchema: row.request_schema as Record<string, unknown>,
    responseSchema: row.response_schema as Record<string, unknown>,
    async: row.async,
    timeoutMs: row.timeout_ms,
    retries: row.retries,
    description: row.description,
  };
}

export async function getNextSequenceNumber(blueprintId: string): Promise<number> {
  const [row] = await db
    .select({ maxSeq: max(bhudhiProtocolMessages.sequence_number) })
    .from(bhudhiProtocolMessages)
    .where(eq(bhudhiProtocolMessages.blueprint_id, blueprintId));

  return Number(row?.maxSeq ?? 0) + 1;
}

export async function persistProtocolMessage(
  blueprintId: string,
  message: BhudhiMessage,
  routeId: string,
  sequenceNumber: number,
): Promise<StoredProtocolMessage> {
  const [row] = await db
    .insert(bhudhiProtocolMessages)
    .values({
      blueprint_id: blueprintId,
      version: message.version,
      message_type: message.messageType,
      from_engine: message.from,
      to_engine: message.to,
      uri: message.uri,
      payload: message.payload,
      route_id: routeId,
      sequence_number: sequenceNumber,
      status: "sent",
    })
    .returning();

  return toStoredMessage(row);
}

export async function fetchProtocolMessage(messageId: string): Promise<StoredProtocolMessage | null> {
  const [row] = await db
    .select()
    .from(bhudhiProtocolMessages)
    .where(eq(bhudhiProtocolMessages.id, messageId))
    .limit(1);

  return row ? toStoredMessage(row) : null;
}

export async function updateProtocolMessageStatus(
  messageId: string,
  status: ProtocolMessageStatus,
  latencyMs?: number,
): Promise<StoredProtocolMessage | null> {
  const [row] = await db
    .update(bhudhiProtocolMessages)
    .set({
      status,
      processed_at: new Date(),
      latency_ms: latencyMs,
    })
    .where(eq(bhudhiProtocolMessages.id, messageId))
    .returning();

  return row ? toStoredMessage(row) : null;
}

export async function fetchProtocolHistory(
  blueprintId: string,
  from?: string,
  to?: string,
  limit = 100,
): Promise<StoredProtocolMessage[]> {
  const conditions = [eq(bhudhiProtocolMessages.blueprint_id, blueprintId)];
  if (from) conditions.push(eq(bhudhiProtocolMessages.from_engine, from));
  if (to) conditions.push(eq(bhudhiProtocolMessages.to_engine, to));

  const rows = await db
    .select()
    .from(bhudhiProtocolMessages)
    .where(and(...conditions))
    .orderBy(desc(bhudhiProtocolMessages.sent_at))
    .limit(limit);

  return rows.map(toStoredMessage);
}

export async function upsertProtocolRoute(
  pattern: string,
  handler: string,
  requestSchema: Record<string, unknown>,
  responseSchema: Record<string, unknown>,
  description: string,
): Promise<ProtocolRouteRecord> {
  const [row] = await db
    .insert(bhudhiProtocolRoutes)
    .values({
      pattern,
      handler,
      request_schema: requestSchema,
      response_schema: responseSchema,
      description,
    })
    .onConflictDoUpdate({
      target: bhudhiProtocolRoutes.pattern,
      set: {
        handler,
        request_schema: requestSchema,
        response_schema: responseSchema,
        description,
        updated_at: new Date(),
      },
    })
    .returning();

  return toRouteRecord(row);
}

export async function fetchProtocolRouteByPattern(pattern: string): Promise<ProtocolRouteRecord | null> {
  const [row] = await db
    .select()
    .from(bhudhiProtocolRoutes)
    .where(eq(bhudhiProtocolRoutes.pattern, pattern))
    .limit(1);

  return row ? toRouteRecord(row) : null;
}

export async function listProtocolRoutes(): Promise<ProtocolRouteRecord[]> {
  const rows = await db.select().from(bhudhiProtocolRoutes);
  return rows.map(toRouteRecord);
}

export async function upsertProtocolContract(
  engineA: string,
  engineB: string,
  messageTypes: string[],
  guarantees: string[],
): Promise<void> {
  await db
    .insert(bhudhiProtocolContracts)
    .values({
      engine_a: engineA,
      engine_b: engineB,
      message_types: messageTypes,
      guarantees,
      active: true,
    })
    .onConflictDoUpdate({
      target: [bhudhiProtocolContracts.engine_a, bhudhiProtocolContracts.engine_b],
      set: {
        message_types: messageTypes,
        guarantees,
        active: true,
        updated_at: new Date(),
      },
    });
}

export async function hasProtocolContract(engineA: string, engineB: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(bhudhiProtocolContracts)
    .where(
      and(
        eq(bhudhiProtocolContracts.engine_a, engineA),
        eq(bhudhiProtocolContracts.engine_b, engineB),
        eq(bhudhiProtocolContracts.active, true),
      ),
    )
    .limit(1);

  return !!row;
}
