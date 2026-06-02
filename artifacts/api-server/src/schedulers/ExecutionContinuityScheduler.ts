/**
 * GAP G5 — daily midnight UTC execution cycle (DOC_11).
 * Inactivity scans: Phase 1 InactivityWorker (30-minute pg-boss schedule).
 */

import { db, blueprints, phases } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { runDailyLoopsForAllActiveBlueprints } from "../engines/execution-loop/DailyLoopEngine.js";
import {
  revealAllDueTasksGlobal,
  topOffTaskQueuesForActiveBlueprints,
} from "../engines/task-engine/TaskEngine.js";
import { runDailyCycleForAllActiveBlueprints } from "../workers/DailyCycleWorker.js";

const HOUR_MS = 60 * 60 * 1000;
const timers: ReturnType<typeof setInterval>[] = [];
let midnightTimeout: ReturnType<typeof setTimeout> | null = null;

/** @deprecated Use InactivityWorker 30-minute schedule. */
export async function runHourlyInactivityScan(): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.INACTIVITY_SCAN_REQUESTED,
    entityType: "system",
    entityId: "inactivity_scan",
    payload: { trigger: "legacy_hourly_hook" },
    idempotencyKey: `inactivity_scan_hourly:${Math.floor(Date.now() / HOUR_MS)}`,
  }).catch(() => null);
}

export async function runDailyTaskCycle(): Promise<void> {
  const revealed = await revealAllDueTasksGlobal().catch(() => 0);
  const toppedOff = await topOffTaskQueuesForActiveBlueprints().catch(() => 0);
  logger.info({ revealed, toppedOff }, "[ExecutionContinuity] Visibility reveal + queue top-off complete");

  const dayKey = new Date().toISOString().slice(0, 10);
  const active = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  for (const bp of active) {
    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "blueprint",
      entityId: bp.id,
      userId: bp.user_id,
      blueprintId: bp.id,
      payload: { trigger: "daily_cycle", generation_mode: "daily" },
      idempotencyKey: `daily:${bp.id}:${dayKey}`,
    }).catch(() => null);
  }

  const dailyTopUp = await runDailyCycleForAllActiveBlueprints();
  const loopCount = await runDailyLoopsForAllActiveBlueprints();
  logger.info(
    { blueprints: active.length, loopCount, dailyTopUp, dayKey },
    "[ExecutionContinuity] Daily task cycle complete",
  );

  const { evaluatePhaseReadiness, advancePhase } = await import(
    "../engines/blueprint/PhaseProgressionEngine.js"
  );

  for (const bp of active) {
    const [row] = await db
      .select({ currentPhaseId: blueprints.current_phase_id })
      .from(blueprints)
      .where(eq(blueprints.id, bp.id))
      .limit(1);
    if (!row?.currentPhaseId) continue;

    const readiness = await evaluatePhaseReadiness(bp.id, row.currentPhaseId);
    if (!readiness.canAdvance) continue;

    const phaseRows = await db
      .select()
      .from(phases)
      .where(eq(phases.blueprint_id, bp.id))
      .orderBy(asc(phases.order_index));

    const idx = phaseRows.findIndex((p) => p.id === row.currentPhaseId);
    const next = idx >= 0 ? phaseRows[idx + 1] : undefined;
    if (!next) continue;

    await advancePhase(bp.id, row.currentPhaseId, next.id).catch(() => null);
  }
}

function msUntilNextMidnightUtc(): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  ));
  return Math.max(1000, next.getTime() - now.getTime());
}

function scheduleMidnightUtcDailyCycle(): void {
  const run = () => {
    void runDailyTaskCycle().catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[ExecutionContinuity] Midnight daily cycle failed",
      );
    });
    scheduleMidnightUtcDailyCycle();
  };

  if (midnightTimeout) clearTimeout(midnightTimeout);
  midnightTimeout = setTimeout(run, msUntilNextMidnightUtc());
  logger.info(
    { msUntilRun: msUntilNextMidnightUtc() },
    "[ExecutionContinuity] Midnight UTC daily cycle scheduled",
  );
}

export function startExecutionContinuitySchedulers(): void {
  // Do not run inactivity scan on boot — incomplete schemas used to crash the process
  // (relation does not exist) before the HTTP server could serve traffic.

  scheduleMidnightUtcDailyCycle();

  logger.info("[ExecutionContinuity] Midnight UTC daily cycle started (inactivity via InactivityWorker)");
}

export function stopExecutionContinuitySchedulers(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  if (midnightTimeout) {
    clearTimeout(midnightTimeout);
    midnightTimeout = null;
  }
}
