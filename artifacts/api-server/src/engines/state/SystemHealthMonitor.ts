/**
 * DOC 17 — read-only system health aggregation (Phase 2).
 */

import { pool, db, systemHealthLogs } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getEventSystemHealth } from "../../services/EventDispatcher.js";
import { deadLetterQueue } from "../../services/DeadLetterQueue.js";
import { collectProductionMetrics } from "../../services/MonitoringMetricsService.js";

export type SystemHealthStatus = "healthy" | "degraded" | "critical";

export interface SystemHealthSnapshot {
  status: SystemHealthStatus;
  checks: Record<string, boolean>;
  metrics: Record<string, number | string | null>;
}

const LAST_INACTIVITY_KEY = "last_inactivity_worker_run";
const LAST_INTEGRITY_KEY = "last_state_integrity_run";

let lastInactivityRunAt: string | null = null;
let lastIntegrityRunAt: string | null = null;

export function recordInactivityWorkerRun(): void {
  lastInactivityRunAt = new Date().toISOString();
}

export function recordStateIntegrityRun(): void {
  lastIntegrityRunAt = new Date().toISOString();
}

export class SystemHealthMonitor {
  async getSnapshot(): Promise<SystemHealthSnapshot> {
    const eventHealth = await getEventSystemHealth();
    const metrics = await collectProductionMetrics();
    const dlq = await deadLetterQueue.listUnresolved(1);

    const pendingOld = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::int AS count FROM events
      WHERE status IN ('pending', 'retry_pending')
        AND created_at < NOW() - INTERVAL '2 minutes'
    `);

    const bhudhiSuccess = await pool.query<{ rate: string }>(`
      SELECT
        CASE WHEN COUNT(*) = 0 THEN 1
        ELSE COUNT(*) FILTER (WHERE status = 'success')::float / COUNT(*)::float
        END AS rate
      FROM (
        SELECT status FROM bhudhi_logs
        ORDER BY created_at DESC
        LIMIT 100
      ) recent
    `);

    const [lastIntegrityLog] = await db
      .select({ created_at: systemHealthLogs.created_at })
      .from(systemHealthLogs)
      .where(eq(systemHealthLogs.check_type, "state_integrity_validator"))
      .orderBy(desc(systemHealthLogs.created_at))
      .limit(1);

    const pendingBacklog = Number(pendingOld.rows[0]?.count ?? 0);
    const dlqCount = eventHealth.unresolved_dead_letters;
    const bhudhiRate = Number(bhudhiSuccess.rows[0]?.rate ?? 1);

    const checks: Record<string, boolean> = {
      event_backlog_ok: pendingBacklog < 10,
      dead_letter_ok: dlqCount < 25,
      bhudhi_success_ok: bhudhiRate >= 0.85,
      inactivity_worker_recent:
        lastInactivityRunAt != null &&
        Date.now() - new Date(lastInactivityRunAt).getTime() < 60 * 60 * 1000,
      integrity_validator_recent:
        lastIntegrityRunAt != null
          ? Date.now() - new Date(lastIntegrityRunAt).getTime() < 15 * 60 * 1000
          : Boolean(lastIntegrityLog?.created_at &&
              Date.now() - lastIntegrityLog.created_at.getTime() < 15 * 60 * 1000),
    };

    let status: SystemHealthStatus = "healthy";
    if (!checks.event_backlog_ok || !checks.bhudhi_success_ok) status = "degraded";
    if (!checks.dead_letter_ok || !checks.inactivity_worker_recent) status = "degraded";
    if (pendingBacklog > 50 || dlqCount > 200 || bhudhiRate < 0.5) status = "critical";

    return {
      status,
      checks,
      metrics: {
        pending_events: eventHealth.pending_events,
        pending_events_stale_2m: pendingBacklog,
        dead_letter_count: dlqCount,
        bhudhi_success_rate: Math.round(bhudhiRate * 100) / 100,
        event_latency_p50_ms: metrics.event_processing_latency_ms_p50,
        last_inactivity_worker_run: lastInactivityRunAt,
        last_integrity_run: lastIntegrityRunAt ?? lastIntegrityLog?.created_at?.toISOString() ?? null,
        oldest_pending_event_age_ms: metrics.oldest_pending_event_age_ms,
        collected_at: metrics.collected_at,
        latest_dlq_event_type: dlq[0]?.eventType ?? null,
      },
    };
  }
}

export const systemHealthMonitor = new SystemHealthMonitor();
