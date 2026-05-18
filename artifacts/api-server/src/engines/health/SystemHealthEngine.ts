/**
 * Prompt 8 — deterministic system health scoring (no AI).
 */
import {
  db,
  events,
  deadLetterEvents,
  systemHealthRecords,
  blueprints,
  orders,
  signalSnapshots,
  bhudhiLogs,
} from "@workspace/db";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { emitEvent, EVENT_TYPES } from "../event/EventSystem.js";
import { pool } from "@workspace/db";

export interface HealthScoreInput {
  dlqSize: number;
  bhudhiFallbackRate: number;
  missedWorkers: number;
  staleUserCount: number;
  activeUserCount: number;
  signalLagHours: number;
}

export interface SystemHealthSnapshot {
  healthScore: number;
  signalEngineHealth: number;
  conditionEngineHealth: number;
  bhudhiHealth: number;
  dbHealth: number;
  workerHealth: number;
  eisHealth: number;
  criticalAlerts: string[];
  warnings: string[];
  dlqSize: number;
  pendingEvents: number;
  staleUsers: number;
}

/** Deterministic penalty formula from Prompt 8 §5. */
export function computeHealthScore(input: HealthScoreInput): number {
  let score = 1.0;
  if (input.dlqSize > 5) score -= 0.1;
  if (input.dlqSize > 20) score -= 0.2;
  if (input.bhudhiFallbackRate > 0.3) score -= 0.15;
  score -= 0.1 * input.missedWorkers;
  if (input.activeUserCount > 0 && input.staleUserCount / input.activeUserCount > 0.1) {
    score -= 0.15;
  }
  if (input.signalLagHours > 2) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}

export function healthStatusFromScore(score: number): "HEALTHY" | "DEGRADED" | "CRITICAL" {
  if (score < 0.5) return "CRITICAL";
  if (score < 0.7) return "DEGRADED";
  return "HEALTHY";
}

export async function runHealthCheck(): Promise<SystemHealthSnapshot> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [{ dlqSize }] = await db
    .select({ dlqSize: sql<number>`count(*)::int` })
    .from(deadLetterEvents)
    .where(eq(deadLetterEvents.resolved, false));

  const [{ pendingEvents }] = await db
    .select({ pendingEvents: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        inArray(events.status, ["pending", "claimed", "retry_pending"]),
        lt(events.process_after, fiveMinAgo),
      ),
    );

  const activeBlueprints = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  let staleUsers = 0;
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  for (const bp of activeBlueprints) {
    const [activeOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.blueprint_id, bp.id), eq(orders.status, "active")))
      .limit(1);
    if (!activeOrder) {
      staleUsers++;
      continue;
    }
    const [recentFb] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.blueprint_id, bp.id), gt(orders.updated_at, fortyEightHoursAgo)),
      )
      .limit(1);
    if (!recentFb) staleUsers++;
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [logStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      fallbacks: sql<number>`count(*) filter (where ${bhudhiLogs.fallback_used} = true)::int`,
    })
    .from(bhudhiLogs)
    .where(gt(bhudhiLogs.created_at, dayAgo));

  const bhudhiFallbackRate =
    (logStats?.total ?? 0) > 0 ? (logStats?.fallbacks ?? 0) / (logStats?.total ?? 1) : 0;

  const [latestSignal] = await db
    .select({ created_at: signalSnapshots.created_at })
    .from(signalSnapshots)
    .orderBy(desc(signalSnapshots.created_at))
    .limit(1);

  const signalLagHours = latestSignal
    ? (Date.now() - latestSignal.created_at.getTime()) / (60 * 60 * 1000)
    : 24;

  let dbHealth = 1;
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    if (Date.now() - start > 500) dbHealth = 0.7;
  } catch {
    dbHealth = 0;
  }

  const missedWorkers =
    (pendingEvents ?? 0) > 20 ? 2 : (pendingEvents ?? 0) > 5 ? 1 : 0;

  const healthScore = computeHealthScore({
    dlqSize: dlqSize ?? 0,
    bhudhiFallbackRate,
    missedWorkers,
    staleUserCount: staleUsers,
    activeUserCount: activeBlueprints.length || 1,
    signalLagHours,
  });

  const criticalAlerts: string[] = [];
  const warnings: string[] = [];
  if ((dlqSize ?? 0) > 50) criticalAlerts.push("DLQ_CRITICAL");
  else if ((dlqSize ?? 0) > 10) warnings.push("DLQ_ELEVATED");
  if (signalLagHours > 2) warnings.push("SIGNAL_LAG");
  if (bhudhiFallbackRate > 0.3) warnings.push("BHUDHI_FALLBACK_HIGH");

  const snapshot: SystemHealthSnapshot = {
    healthScore,
    signalEngineHealth: signalLagHours > 2 ? 0.6 : 1,
    conditionEngineHealth: 1,
    bhudhiHealth: 1 - bhudhiFallbackRate * 0.5,
    dbHealth,
    workerHealth: missedWorkers > 0 ? 0.8 - missedWorkers * 0.1 : 1,
    eisHealth: 1,
    criticalAlerts,
    warnings,
    dlqSize: dlqSize ?? 0,
    pendingEvents: pendingEvents ?? 0,
    staleUsers,
  };

  try {
    await db.insert(systemHealthRecords).values({
      health_score: snapshot.healthScore,
      signal_engine_health: snapshot.signalEngineHealth,
      condition_engine_health: snapshot.conditionEngineHealth,
      bhudhi_health: snapshot.bhudhiHealth,
      db_health: snapshot.dbHealth,
      worker_health: snapshot.workerHealth,
      eis_health: snapshot.eisHealth,
      critical_alerts: snapshot.criticalAlerts,
      warnings: snapshot.warnings,
      dlq_size: snapshot.dlqSize,
      pending_events: snapshot.pendingEvents,
      stale_users: snapshot.staleUsers,
    });
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[SystemHealthEngine] Could not persist health record (run phase8 migration)",
    );
  }

  await generateHealthAlert(snapshot);
  return snapshot;
}

export async function generateHealthAlert(snapshot: SystemHealthSnapshot): Promise<void> {
  if (snapshot.healthScore >= 0.7 && snapshot.dlqSize <= 10) return;

  await emitEvent({
    eventType: EVENT_TYPES.HEALTH_ALERT,
    sourceEngine: "system_health_engine",
    payload: {
      healthScore: snapshot.healthScore,
      dlqSize: snapshot.dlqSize,
      status: healthStatusFromScore(snapshot.healthScore),
      criticalAlerts: snapshot.criticalAlerts,
    },
    idempotencyKey: `health_alert:${Math.floor(Date.now() / 1800000)}`,
    entityType: "system",
    entityId: "health",
    priority: snapshot.dlqSize > 50 ? "CRITICAL" : "HIGH",
  }).catch(() => null);
}
