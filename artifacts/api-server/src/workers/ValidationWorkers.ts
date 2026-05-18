/**
 * Prompt 8 — background validation workers (scheduled via ProductionScheduler).
 */
import { db, blueprints, orders, feedback, worldModels, signalSnapshots, knowledgePackages } from "@workspace/db";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { resolveSignalDrift } from "../lib/sourceOfTruth.js";
import { cleanExpiredIdempotencyRecords, handleDLQ, emitEvent, EVENT_TYPES } from "../engines/event/EventSystem.js";
import { runHealthCheck } from "../engines/health/SystemHealthEngine.js";
import { enrichPackagesWithEIS } from "../bhudhi/agents/KnowledgeAgent.js";
import { runFullNightlyResearch } from "../engines/eis/EISEngine.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";
import { events } from "@workspace/db";

const DRIFT_THRESHOLD = 0.2;

/** Worker 1 — compare WorldModel trajectory vs latest SignalSnapshot. */
export async function validateSignalDrift(): Promise<number> {
  const active = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  let corrected = 0;
  for (const bp of active) {
    const world = await getWorldModel(bp.user_id);
    if (!world) continue;

    const [snap] = await db
      .select({
        completion_rate: signalSnapshots.completion_rate,
        momentum: signalSnapshots.momentum,
      })
      .from(signalSnapshots)
      .where(eq(signalSnapshots.blueprint_id, bp.id))
      .orderBy(desc(signalSnapshots.created_at))
      .limit(1);

    if (!snap) continue;

    const worldTraj = {
      completionRate: 1 - (world.signalTrajectory.completionRateDrift ?? 0),
      momentum: 50,
    };
    const signalTraj = {
      completionRate: snap.completion_rate,
      momentum: snap.momentum,
    };

    const { corrected: fixed, updated, drift } = resolveSignalDrift(
      worldTraj,
      signalTraj,
      DRIFT_THRESHOLD,
    );

    if (!updated) continue;

    corrected++;
    const trend =
      fixed.completionRate > worldTraj.completionRate ? "rising"
      : fixed.completionRate < worldTraj.completionRate ? "declining"
      : "stable";

    await db
      .update(worldModels)
      .set({
        signal_trajectory: {
          ...world.signalTrajectory,
          completionRateTrend: trend,
          completionRateDrift: 1 - fixed.completionRate,
          momentumDrift: Math.abs(fixed.momentum - snap.momentum) / 100,
        },
        state_version: world.stateVersion + 1,
      })
      .where(eq(worldModels.user_id, bp.user_id));

    logger.info(
      { userId: bp.user_id, blueprintId: bp.id, drift },
      "[ValidationWorkers] Signal drift corrected (SignalRecord wins)",
    );
  }
  return corrected;
}

/** Worker 2 — stale active orders with no recent feedback. */
export async function cleanOrphanOrders(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let cleaned = 0;

  const staleOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, "active"), lt(orders.updated_at, sevenDaysAgo)))
    .limit(100);

  for (const order of staleOrders) {
    await db.update(orders).set({ status: "blocked" }).where(eq(orders.id, order.id));
    cleaned++;

    await emitEvent({
      eventType: EVENT_TYPES.INACTIVITY_DETECTED,
      sourceEngine: "orphan_order_cleaner",
      userId: order.user_id,
      blueprintId: order.blueprint_id,
      orderId: order.id,
      payload: { orderId: order.id, reason: "orphan_stale" },
      idempotencyKey: `inactivity:${order.id}:${sevenDaysAgo.toISOString().slice(0, 10)}`,
      entityType: "order",
      entityId: order.id,
    }).catch(() => null);
  }
  return cleaned;
}

/** Worker 3 — DLQ processor every 15 minutes. */
export async function processDLQ(): Promise<void> {
  await handleDLQ();
}

/** Worker 4 — delete expired idempotency keys. */
export async function runIdempotencyCleaner(): Promise<number> {
  return cleanExpiredIdempotencyRecords();
}

/** Worker 5 — pending/stuck event detection. */
export async function checkEventPipelineHealth(): Promise<void> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

  const [{ pendingOld }] = await db
    .select({ pendingOld: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(eq(events.status, "pending"), lt(events.created_at, fiveMinAgo)),
    );

  const [{ claimedStuck }] = await db
    .select({ claimedStuck: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.status, "claimed"), lt(events.created_at, tenMinAgo)));

  if ((pendingOld ?? 0) > 0 || (claimedStuck ?? 0) > 0) {
    await runHealthCheck();
    await dispatchPendingEvents().catch(() => null);
  }
}

/** Worker 6 — refresh knowledge packages from EIS (rate-limited per domain). */
export async function refreshEISKnowledgeLibrary(): Promise<number> {
  const domains = await db
    .selectDistinct({ domain: knowledgePackages.domain })
    .from(knowledgePackages)
    .limit(20);

  let updated = 0;
  for (const { domain } of domains) {
    const [bp] = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.active, true), eq(blueprints.current_domain, domain as never)))
      .limit(1);

    if (!bp) continue;

    const briefing = await runFullNightlyResearch(bp.user_id, {
      userId: bp.user_id,
      blueprintId: bp.id,
      domain: domain ?? "Content",
      niche: bp.role_context ?? "general",
      industry: bp.domain_hint ?? domain,
    }).catch(() => null);

    if (!briefing) continue;

    const count = await enrichPackagesWithEIS(bp.user_id, domain, {
      trendingTopics: briefing.trendingTopics.map((t) => t.topic),
      researchMethod: briefing.researchMethod,
    });
    updated += count;
  }
  return updated;
}

export function startValidationWorkerSchedules(
  schedule: (ms: number, name: string, fn: () => Promise<void>) => void,
): void {
  schedule(2 * 60 * 60 * 1000, "signal_drift_validator", async () => {
    await validateSignalDrift();
  });

  schedule(6 * 60 * 60 * 1000, "orphan_order_cleaner", async () => {
    await cleanOrphanOrders();
  });

  schedule(15 * 60 * 1000, "dlq_processor", async () => {
    await processDLQ();
  });

  schedule(24 * 60 * 60 * 1000, "idempotency_cleaner", async () => {
    await runIdempotencyCleaner();
  });

  schedule(30 * 60 * 1000, "event_pipeline_health", async () => {
    await checkEventPipelineHealth();
  });

  schedule(24 * 60 * 60 * 1000, "eis_knowledge_refresh", async () => {
    await refreshEISKnowledgeLibrary();
  });

  logger.info("[ValidationWorkers] Schedules registered");
}
