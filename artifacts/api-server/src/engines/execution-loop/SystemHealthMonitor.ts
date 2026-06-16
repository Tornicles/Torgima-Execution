/**
 * DOC17 Task 2 — system health metrics, degraded mode, integrity sweep.
 */

import { db, pool, events, deadLetterEvents } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { processFindings, runIntegrityChecks } from "../../services/SystemHealthService.js";
import { recordStateIntegrityRun } from "../state/SystemHealthMonitor.js";
import { runStateIntegrityEngine } from "./StateIntegrityEngine.js";
import {
  activateDegradedMode,
  recoverDegradedMode,
  isDegradedMode,
} from "./DegradedMode.js";

export const HEALTH_MONITOR_INTERVAL_MS = 5 * 60 * 1000;

export interface HealthMonitorMetrics {
  pending_event_backlog: number;
  dead_letter_last_hour: number;
  bhudhi_failure_rate: number;
  feedback_latency_p95_ms: number | null;
  degraded_mode: boolean;
}

export interface HealthMonitorResult {
  metrics: HealthMonitorMetrics;
  integrityOk: boolean;
  findingsCount: number;
  alertsEmitted: number;
}

async function countPendingBacklog(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.status, EventStatus.PENDING),
        sql`${events.process_after} <= NOW()`,
      ),
    );
  return count ?? 0;
}

async function countDeadLettersLastHour(): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deadLetterEvents)
    .where(gte(deadLetterEvents.created_at, since));
  return count ?? 0;
}

async function bhudhiFailureRateLastHour(): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const result = await pool.query<{ total: string; failed: string }>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE validation_status = 'error')::int AS failed
    FROM bhudhi_logs
    WHERE created_at >= $1
  `, [since]);
  const total = Number(result.rows[0]?.total ?? 0);
  const failed = Number(result.rows[0]?.failed ?? 0);
  if (total === 0) return 0;
  return failed / total;
}

async function feedbackLatencyP95Ms(): Promise<number | null> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const result = await pool.query<{ p95: string | null }>(`
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
    FROM event_logs
    WHERE worker = 'FeedbackWorker'
      AND result = 'success'
      AND processed_at >= $1
      AND duration_ms IS NOT NULL
  `, [since]);
  const p95 = result.rows[0]?.p95;
  return p95 != null ? Number(p95) : null;
}

async function emitHealthAlert(
  reason: string,
  severity: "WARN" | "ERROR" | "CRITICAL",
  metrics: Record<string, unknown>,
): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
    entityType: "system",
    entityId: "health_monitor",
    payload: { reason, severity, ...metrics },
    idempotencyKey: `health_monitor:${reason}:${Math.floor(Date.now() / 300000)}`,
  }).catch(() => null);

  if (severity === "ERROR" || severity === "CRITICAL") {
    await activateDegradedMode({ reason, severity });
  }
}

/** DOC17 — full monitoring cycle (metrics + integrity + repairs). */
export async function runHealthMonitoringCycle(): Promise<HealthMonitorResult> {
  const [
    pendingBacklog,
    dlqHour,
    bhudhiFailRate,
    feedbackLatency,
    degraded,
  ] = await Promise.all([
    countPendingBacklog(),
    countDeadLettersLastHour(),
    bhudhiFailureRateLastHour(),
    feedbackLatencyP95Ms(),
    isDegradedMode(),
  ]);

  const metrics: HealthMonitorMetrics = {
    pending_event_backlog: pendingBacklog,
    dead_letter_last_hour: dlqHour,
    bhudhi_failure_rate: Math.round(bhudhiFailRate * 1000) / 1000,
    feedback_latency_p95_ms: feedbackLatency,
    degraded_mode: degraded,
  };

  let alertsEmitted = 0;

  if (pendingBacklog > 500) {
    await emitHealthAlert("event_backlog_critical", "CRITICAL", metrics as unknown as Record<string, unknown>);
    alertsEmitted++;
  } else if (pendingBacklog > 100) {
    await emitHealthAlert("event_backlog_high", "WARN", metrics as unknown as Record<string, unknown>);
    alertsEmitted++;
  }

  if (dlqHour > 50) {
    await emitHealthAlert("dead_letter_rate_critical", "ERROR", metrics as unknown as Record<string, unknown>);
    alertsEmitted++;
  } else if (dlqHour > 10) {
    await emitHealthAlert("dead_letter_rate_high", "WARN", metrics as unknown as Record<string, unknown>);
    alertsEmitted++;
  }

  if (bhudhiFailRate > 0.5) {
    await emitHealthAlert("bhudhi_failure_critical", "ERROR", metrics as unknown as Record<string, unknown>);
    alertsEmitted++;
  } else if (bhudhiFailRate > 0.2) {
    await emitHealthAlert("bhudhi_failure_high", "WARN", metrics as unknown as Record<string, unknown>);
    alertsEmitted++;
  }

  if (feedbackLatency != null) {
    if (feedbackLatency > 30_000) {
      await emitHealthAlert("feedback_latency_critical", "ERROR", { ...metrics, feedbackLatency });
      alertsEmitted++;
    } else if (feedbackLatency > 10_000) {
      await emitHealthAlert("feedback_latency_high", "WARN", { ...metrics, feedbackLatency });
      alertsEmitted++;
    }
  }

  const [serviceFindings, integrity] = await Promise.all([
    runIntegrityChecks(),
    runStateIntegrityEngine(),
  ]);
  const findings = [...serviceFindings, ...integrity.findings];
  await processFindings(findings);

  recordStateIntegrityRun();

  const healthy =
    pendingBacklog <= 100 &&
    dlqHour <= 10 &&
    bhudhiFailRate <= 0.2 &&
    integrity.ok &&
    !findings.some((f) => f.severity === "CRITICAL" || f.severity === "FATAL");

  if (degraded && healthy) {
    await recoverDegradedMode();
  }

  logger.info(
    { metrics, integrityOk: integrity.ok, findings: findings.length, alertsEmitted },
    "[SystemHealthMonitor] Cycle complete",
  );

  return {
    metrics,
    integrityOk: integrity.ok,
    findingsCount: findings.length,
    alertsEmitted,
  };
}

export { isDegradedMode, activateDegradedMode, recoverDegradedMode, degradedDashboardMessage } from "./DegradedMode.js";
