import { and, desc, eq } from "drizzle-orm";
import { db, erectorBlueprintLaunchContracts, erectorSignals, erectorSystemErrorRecords } from "@workspace/db";
import { runErectorSignalEngine } from "../engines/erector/signals/ErectorSignalEngine.js";
import { EVENT_TYPES, writeEvent } from "../services/EventService.js";
import { logger } from "../lib/logger.js";
import type { WorkerJobData, WorkerResult } from "./BaseWorkerHandler.js";

export const ERECTOR_SIGNAL_RECALC_INTERVAL_HOURS = 4;

/** Core execution-linked Erector signals recalculated by the bridge (Gap Fix 4). */
export const ERECTOR_BRIDGE_SIGNAL_TYPES = [
  "QUALITY_SIGNAL",
  "CONSISTENCY_SIGNAL",
  "COMPLETION_SIGNAL",
  "OUTCOME_MOVEMENT_SIGNAL",
  "CAPABILITY_SIGNAL",
  "DEMAND_SIGNAL",
  "FALSE_PROGRESS_SIGNAL",
  "PHASE_READINESS_SIGNAL",
] as const;

export async function hasConsumedErectorLaunchContract(blueprintId: string): Promise<boolean> {
  const [contract] = await db
    .select({ id: erectorBlueprintLaunchContracts.id })
    .from(erectorBlueprintLaunchContracts)
    .where(
      and(
        eq(erectorBlueprintLaunchContracts.blueprint_id, blueprintId),
        eq(erectorBlueprintLaunchContracts.consumed, true),
      ),
    )
    .limit(1);

  return Boolean(contract);
}

export async function shouldRecalculateErectorSignals(
  userId: string,
  blueprintId: string,
): Promise<boolean> {
  const [latest] = await db
    .select({ generated_at: erectorSignals.generated_at })
    .from(erectorSignals)
    .where(
      and(
        eq(erectorSignals.user_id, userId),
        eq(erectorSignals.blueprint_id, blueprintId),
        eq(erectorSignals.status, "current"),
      ),
    )
    .orderBy(desc(erectorSignals.generated_at))
    .limit(1);

  if (!latest?.generated_at) return true;

  const hoursSinceLast =
    (Date.now() - new Date(latest.generated_at).getTime()) / 3_600_000;
  return hoursSinceLast >= ERECTOR_SIGNAL_RECALC_INTERVAL_HOURS;
}

async function writeBridgeError(
  userId: string,
  blueprintId: string,
  message: string,
): Promise<void> {
  await db.insert(erectorSystemErrorRecords).values({
    error_type: "SIGNAL_CALCULATION_FAILED",
    source_engine: "ErectorSignalBridgeWorker",
    user_id: userId,
    entity_type: "blueprint",
    entity_id: blueprintId,
    error_message: message,
    recovery_action: "retry",
  });
}

export async function handleErectorSignalBridgeJob(data: WorkerJobData): Promise<WorkerResult> {
  const blueprintId = data.blueprintId;
  const userId = data.userId;

  if (!blueprintId || !userId) {
    return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
  }

  const hasContract = await hasConsumedErectorLaunchContract(blueprintId);
  if (!hasContract) {
    logger.debug({ blueprintId }, "[ErectorSignalBridge] Skipping — no consumed launch contract");
    return { success: true, reason: "NO_ERECTOR_LAUNCH_CONTRACT" };
  }

  const shouldRun = await shouldRecalculateErectorSignals(userId, blueprintId);
  if (!shouldRun) {
    logger.debug({ blueprintId }, "[ErectorSignalBridge] Skipping — frequency gate (< 4h)");
    return { success: true, reason: "FREQUENCY_GATE" };
  }

  try {
    const results = await runErectorSignalEngine({
      userId,
      blueprintId,
    });

    const bridgeSignals = results.filter((row) =>
      (ERECTOR_BRIDGE_SIGNAL_TYPES as readonly string[]).includes(row.signal_type),
    );

    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_SIGNAL_CALCULATED,
      entityType: "blueprint",
      entityId: blueprintId,
      userId,
      blueprintId,
      payload: {
        signals_updated: bridgeSignals.length,
        trigger_source: "execution_signal_update",
        signal_types: bridgeSignals.map((row) => row.signal_type),
      },
      idempotencyKey: `erector_signal_calculated:${blueprintId}:${data.eventId}`,
      causationEventId: data.eventId,
    });

    logger.info(
      { blueprintId, signalsUpdated: bridgeSignals.length },
      "[ErectorSignalBridge] Erector signals recalculated",
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeBridgeError(userId, blueprintId, message).catch(() => null);
    logger.warn({ blueprintId, error: message }, "[ErectorSignalBridge] Non-blocking failure");
    return { success: true, reason: "SIGNAL_CALCULATION_FAILED_NON_BLOCKING" };
  }
}
