import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";
import { runIntegrityChecks, processFindings } from "../services/SystemHealthService.js";
import { scanForInactivity } from "../engines/inactivity/InactivityDetectionEngine.js";
import { scanPatterns } from "../engines/pattern/PatternLearningEngine.js";
import { collectProductionMetrics } from "../services/MonitoringMetricsService.js";
import { stopScheduledHealthChecks } from "../workers/HealthWorker.js";
import { startValidationWorkerSchedules } from "../workers/ValidationWorkers.js";
import { runHealthCheck } from "../engines/health/SystemHealthEngine.js";

const timers: ReturnType<typeof setInterval>[] = [];

function schedule(ms: number, name: string, fn: () => Promise<void>): void {
  const t = setInterval(async () => {
    try {
      await fn();
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), job: name },
        "[ProductionScheduler] Job failed",
      );
    }
  }, ms);
  timers.push(t);
  logger.info({ job: name, intervalMs: ms }, "[ProductionScheduler] Registered");
}

export function startProductionSchedulers(): void {
  schedule(5 * 60 * 1000, "health_check", async () => {
    await runHealthCheck().catch(() => null);
    const findings = await runIntegrityChecks();
    await processFindings(findings);
    await writeEvent({
      eventType: EVENT_TYPES.SYSTEM_HEALTH_SCAN_REQUESTED,
      entityType: "system",
      entityId: "health",
      payload: { findings: findings.length },
      idempotencyKey: `health_scan:${Math.floor(Date.now() / 300000)}`,
    }).catch(() => null);
  });

  schedule(30 * 60 * 1000, "dead_letter_review", async () => {
    await writeEvent({
      eventType: EVENT_TYPES.DEAD_LETTER_REVIEW_REQUESTED,
      entityType: "system",
      entityId: "dlq",
      payload: {},
      idempotencyKey: `dlq_review:${Math.floor(Date.now() / 1800000)}`,
    });
  });

  schedule(6 * 60 * 60 * 1000, "signal_refresh", async () => {
    const active = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));
    for (const bp of active) {
      await writeEvent({
        eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
        entityType: "blueprint",
        entityId: bp.id,
        userId: bp.user_id,
        blueprintId: bp.id,
        payload: { trigger: "scheduled_signal_refresh" },
        idempotencyKey: `signal_refresh:${bp.id}:${Math.floor(Date.now() / 21600000)}`,
      }).catch(() => null);
    }
  });

  schedule(24 * 60 * 60 * 1000, "inactivity_check", async () => {
    await scanForInactivity();
  });

  schedule(24 * 60 * 60 * 1000, "pattern_scan", async () => {
    const active = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));
    for (const bp of active) {
      await writeEvent({
        eventType: EVENT_TYPES.PATTERN_SCAN_REQUESTED,
        entityType: "blueprint",
        entityId: bp.id,
        userId: bp.user_id,
        blueprintId: bp.id,
        payload: { window_days: 7 },
        idempotencyKey: `pattern_scan:${bp.id}:${Math.floor(Date.now() / 86400000)}`,
      }).catch(() => null);
    }
  });

  schedule(7 * 24 * 60 * 60 * 1000, "assumption_check", async () => {
    const active = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));
    for (const bp of active) {
      await writeEvent({
        eventType: EVENT_TYPES.ASSUMPTION_CHECK_REQUESTED,
        entityType: "blueprint",
        entityId: bp.id,
        userId: bp.user_id,
        blueprintId: bp.id,
        payload: {},
        idempotencyKey: `assumption_check:${bp.id}:${Math.floor(Date.now() / 604800000)}`,
      }).catch(() => null);
    }
  });

  startValidationWorkerSchedules(schedule);

  schedule(60 * 1000, "metrics_snapshot", async () => {
    const metrics = await collectProductionMetrics();
    if (metrics.pending_event_count > 100 || metrics.dead_letter_count > 20) {
      logger.warn({ metrics }, "[ProductionScheduler] Elevated operational metrics");
    }
  });
}

export function stopProductionSchedulers(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  stopScheduledHealthChecks();
}

export async function runDispatcherOnce(): Promise<number> {
  return dispatchPendingEvents();
}
