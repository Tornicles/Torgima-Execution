/**
 * GAP G5 — hourly inactivity scan + daily midnight UTC execution cycle (DOC_11).
 */

import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { scanForInactivity } from "../engines/inactivity/InactivityDetectionEngine.js";
import { runDailyLoopsForAllActiveBlueprints } from "../engines/execution-loop/DailyLoopEngine.js";
import {
  revealAllDueTasksGlobal,
  topOffTaskQueuesForActiveBlueprints,
} from "../engines/task-engine/TaskEngine.js";

const HOUR_MS = 60 * 60 * 1000;
const timers: ReturnType<typeof setInterval>[] = [];
let midnightTimeout: ReturnType<typeof setTimeout> | null = null;

export async function runHourlyInactivityScan(): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.INACTIVITY_SCAN_REQUESTED,
    entityType: "system",
    entityId: "inactivity_scan",
    payload: { trigger: "hourly_schedule" },
    idempotencyKey: `inactivity_scan_hourly:${Math.floor(Date.now() / HOUR_MS)}`,
  }).catch(() => null);

  const result = await scanForInactivity();
  logger.info(result, "[ExecutionContinuity] Hourly inactivity scan complete");
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

  const loopCount = await runDailyLoopsForAllActiveBlueprints();
  logger.info(
    { blueprints: active.length, loopCount, dayKey },
    "[ExecutionContinuity] Daily task cycle complete",
  );

  const { evaluatePhaseReadiness, advancePhase } = await import(
    "../engines/blueprint/PhaseProgressionEngine.js"
  );
  const { db: database, phases: phasesTable, blueprints: bpTable } = await import("@workspace/db");
  const { eq: eqOp, and: andOp, asc: ascOp } = await import("drizzle-orm");

  for (const bp of active) {
    const [row] = await database
      .select({ currentPhaseId: bpTable.current_phase_id })
      .from(bpTable)
      .where(eqOp(bpTable.id, bp.id))
      .limit(1);
    if (!row?.currentPhaseId) continue;

    const readiness = await evaluatePhaseReadiness(bp.id, row.currentPhaseId);
    if (!readiness.canAdvance) continue;

    const phaseRows = await database
      .select()
      .from(phasesTable)
      .where(eqOp(phasesTable.blueprint_id, bp.id))
      .orderBy(ascOp(phasesTable.order_index));

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

  timers.push(
    setInterval(() => {
      void runHourlyInactivityScan();
    }, HOUR_MS),
  );

  scheduleMidnightUtcDailyCycle();

  logger.info("[ExecutionContinuity] Hourly inactivity + midnight UTC daily cycle started");
}

export function stopExecutionContinuitySchedulers(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  if (midnightTimeout) {
    clearTimeout(midnightTimeout);
    midnightTimeout = null;
  }
}
