import { randomUUID } from "node:crypto";
import {
  db,
  bhudhiKernelEvents,
  bhudhiSharedContext,
  bhudhiEngineRegistry,
  bhudhiExecutionContracts,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import type { KernelEventInput, KernelEventStatus, SharedContextRecord, StoredKernelEvent } from "./contracts/types.js";

const DEFAULT_ENGINES = [
  {
    engine_id: "investigation",
    engine_name: "Investigation Service",
    system: "investigation",
    accepts_events: ["investigation.start"],
    emits_events: ["investigation.complete"],
    requires_context: ["investigations"],
    produces_context: ["investigations"],
  },
  {
    engine_id: "intelligence",
    engine_name: "Intelligence Service",
    system: "intelligence",
    accepts_events: ["intelligence.start", "investigation.complete"],
    emits_events: ["intelligence.complete"],
    requires_context: ["investigations"],
    produces_context: ["strategy", "ideas"],
  },
  {
    engine_id: "security",
    engine_name: "Security Service",
    system: "security",
    accepts_events: ["security.validate", "intelligence.complete"],
    emits_events: ["security.approved", "security.rejected"],
    requires_context: ["strategy"],
    produces_context: ["behavior"],
  },
  {
    engine_id: "operating",
    engine_name: "Operating Service",
    system: "operating",
    accepts_events: ["operating.execute", "security.approved"],
    emits_events: ["operating.complete"],
    requires_context: ["strategy"],
    produces_context: ["execution"],
  },
  {
    engine_id: "preservation",
    engine_name: "Preservation Service",
    system: "preservation",
    accepts_events: ["preservation.learn", "operating.complete"],
    emits_events: ["preservation.complete"],
    requires_context: ["execution"],
    produces_context: ["knowledge"],
  },
  {
    engine_id: "kernel",
    engine_name: "Cognitive Kernel",
    system: "kernel",
    accepts_events: ["kernel.cycle"],
    emits_events: ["investigation.start", "kernel.cycle.complete"],
    requires_context: [],
    produces_context: ["context"],
  },
] as const;

function toStoredEvent(row: typeof bhudhiKernelEvents.$inferSelect): StoredKernelEvent {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    eventType: row.event_type,
    sourceEngine: row.source_engine,
    targetEngine: row.target_engine,
    payload: row.payload as Record<string, unknown>,
    status: row.status as KernelEventStatus,
    processedBy: (row.processed_by as string[]) ?? [],
    parentEventId: row.parent_event_id,
    chainId: row.chain_id,
    createdAt: row.created_at,
  };
}

function toSharedContext(row: typeof bhudhiSharedContext.$inferSelect): SharedContextRecord {
  return {
    blueprintId: row.blueprint_id,
    domain: row.domain,
    phase: row.phase,
    signal: row.signal,
    condition: row.condition,
    context: row.context as Record<string, unknown>,
    ideas: row.ideas as Record<string, unknown>,
    strategy: row.strategy as Record<string, unknown>,
    predictions: row.predictions as Record<string, unknown>,
    knowledge: row.knowledge as Record<string, unknown>,
    behavior: row.behavior as Record<string, unknown>,
    execution: row.execution as Record<string, unknown>,
    investigations: row.investigations as Record<string, unknown>,
    version: row.version,
    lastUpdateEngine: row.last_update_engine,
  };
}

export async function ensureEngineRegistry(): Promise<void> {
  for (const engine of DEFAULT_ENGINES) {
    const existing = await db
      .select({ id: bhudhiEngineRegistry.id })
      .from(bhudhiEngineRegistry)
      .where(eq(bhudhiEngineRegistry.engine_id, engine.engine_id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(bhudhiEngineRegistry).values({
        engine_id: engine.engine_id,
        engine_name: engine.engine_name,
        system: engine.system,
        accepts_events: [...engine.accepts_events],
        emits_events: [...engine.emits_events],
        requires_context: [...engine.requires_context],
        produces_context: [...engine.produces_context],
        status: "active",
        health_check: { ok: true },
        last_active_at: new Date(),
      });
    }
  }
}

export async function persistKernelEvent(input: KernelEventInput): Promise<StoredKernelEvent> {
  const id = input.id ?? randomUUID();
  const chainId = input.chainId ?? id;

  const [row] = await db
    .insert(bhudhiKernelEvents)
    .values({
      id,
      blueprint_id: input.blueprintId,
      event_type: input.eventType,
      source_engine: input.sourceEngine,
      target_engine: input.targetEngine ?? "broadcast",
      payload: input.payload,
      chain_id: chainId,
      parent_event_id: input.parentEventId ?? null,
      status: "emitted",
    })
    .returning();

  return toStoredEvent(row);
}

export async function markEventProcessed(
  eventId: string,
  handlerName: string,
  status: KernelEventStatus = "completed",
): Promise<void> {
  const [row] = await db
    .select()
    .from(bhudhiKernelEvents)
    .where(eq(bhudhiKernelEvents.id, eventId))
    .limit(1);

  if (!row) return;

  const processedBy = [...((row.processed_by as string[]) ?? []), handlerName];

  await db
    .update(bhudhiKernelEvents)
    .set({
      status,
      processed_by: processedBy,
      updated_at: new Date(),
    })
    .where(eq(bhudhiKernelEvents.id, eventId));
}

export async function getEventChain(chainId: string): Promise<StoredKernelEvent[]> {
  const rows = await db
    .select()
    .from(bhudhiKernelEvents)
    .where(eq(bhudhiKernelEvents.chain_id, chainId))
    .orderBy(asc(bhudhiKernelEvents.created_at));

  return rows.map(toStoredEvent);
}

export async function listKernelEvents(blueprintId?: string, chainId?: string): Promise<StoredKernelEvent[]> {
  const conditions = [];
  if (blueprintId) conditions.push(eq(bhudhiKernelEvents.blueprint_id, blueprintId));
  if (chainId) conditions.push(eq(bhudhiKernelEvents.chain_id, chainId));

  let query = db.select().from(bhudhiKernelEvents).$dynamic();
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  const rows = await query.orderBy(asc(bhudhiKernelEvents.created_at)).limit(200);

  return rows.map(toStoredEvent);
}

export async function cleanupOldKernelEvents(daysOld = 7): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(bhudhiKernelEvents)
    .where(
      and(
        lt(bhudhiKernelEvents.created_at, cutoff),
        inArray(bhudhiKernelEvents.status, ["completed", "failed"]),
      ),
    )
    .returning({ id: bhudhiKernelEvents.id });

  return deleted.length;
}

export async function getOrCreateSharedContext(blueprintId: string): Promise<SharedContextRecord> {
  const [existing] = await db
    .select()
    .from(bhudhiSharedContext)
    .where(eq(bhudhiSharedContext.blueprint_id, blueprintId))
    .limit(1);

  if (existing) return toSharedContext(existing);

  const [row] = await db
    .insert(bhudhiSharedContext)
    .values({
      blueprint_id: blueprintId,
      domain: "genesis",
      phase: "initiation",
      signal: "nothingness",
      condition: "nothingness",
      last_update_engine: "system",
    })
    .returning();

  return toSharedContext(row);
}

export async function updateSharedContext(
  blueprintId: string,
  updates: Partial<{
    domain: string;
    phase: string;
    signal: string;
    condition: string;
    context: Record<string, unknown>;
    ideas: Record<string, unknown>;
    strategy: Record<string, unknown>;
    predictions: Record<string, unknown>;
    knowledge: Record<string, unknown>;
    behavior: Record<string, unknown>;
    execution: Record<string, unknown>;
    investigations: Record<string, unknown>;
  }>,
  engine: string,
): Promise<SharedContextRecord> {
  const current = await getOrCreateSharedContext(blueprintId);
  const [row] = await db
    .select()
    .from(bhudhiSharedContext)
    .where(eq(bhudhiSharedContext.blueprint_id, blueprintId))
    .limit(1);

  if (!row) throw new Error(`Context not found for blueprint ${blueprintId}`);

  const [updated] = await db
    .update(bhudhiSharedContext)
    .set({
      ...updates,
      version: row.version + 1,
      last_update_engine: engine,
      last_update_time: new Date(),
      updated_at: new Date(),
    })
    .where(eq(bhudhiSharedContext.blueprint_id, blueprintId))
    .returning();

  void current;
  return toSharedContext(updated);
}

export async function updateSharedSubsystem(
  blueprintId: string,
  subsystem: keyof Pick<
    SharedContextRecord,
    "context" | "ideas" | "strategy" | "predictions" | "knowledge" | "behavior" | "execution" | "investigations"
  >,
  data: Record<string, unknown>,
  engine: string,
): Promise<SharedContextRecord> {
  const ctx = await getOrCreateSharedContext(blueprintId);
  const merged = { ...ctx[subsystem], ...data };
  return updateSharedContext(blueprintId, { [subsystem]: merged }, engine);
}

export async function createExecutionContract(params: {
  blueprintId: string;
  contractType: string;
  input: Record<string, unknown>;
  eventChainId: string;
}): Promise<string> {
  const executionId = randomUUID();
  const [row] = await db
    .insert(bhudhiExecutionContracts)
    .values({
      blueprint_id: params.blueprintId,
      contract_type: params.contractType,
      execution_id: executionId,
      input: params.input,
      status: "executing",
      event_chain_id: params.eventChainId,
      started_at: new Date(),
    })
    .returning({ id: bhudhiExecutionContracts.id });

  return row.id;
}

export async function completeExecutionContract(
  contractId: string,
  output: Record<string, unknown>,
  eventIds: string[],
  error?: string,
): Promise<void> {
  const [row] = await db
    .select({ started_at: bhudhiExecutionContracts.started_at })
    .from(bhudhiExecutionContracts)
    .where(eq(bhudhiExecutionContracts.id, contractId))
    .limit(1);

  const completedAt = new Date();
  const startedAt = row?.started_at ? new Date(row.started_at).getTime() : completedAt.getTime();
  const durationMs = Math.max(0, completedAt.getTime() - startedAt);

  await db
    .update(bhudhiExecutionContracts)
    .set({
      output,
      status: error ? "failed" : "completed",
      completed_at: completedAt,
      duration_ms: durationMs,
      events: eventIds,
      error: error ?? null,
      updated_at: completedAt,
    })
    .where(eq(bhudhiExecutionContracts.id, contractId));
}

export async function listEngineRegistry() {
  await ensureEngineRegistry();
  return db.select().from(bhudhiEngineRegistry).orderBy(desc(bhudhiEngineRegistry.updated_at));
}
