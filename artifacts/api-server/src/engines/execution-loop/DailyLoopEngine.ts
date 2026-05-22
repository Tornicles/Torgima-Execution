import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { enterLoop } from "./ExecutionLoopEngine.js";
import { scanForInactivity } from "../inactivity/InactivityDetectionEngine.js";
import {
  archetypeSignalWindowDays,
  loadBlueprintArchetypeContext,
} from "../erector/ArchetypeExecutionContext.js";

/** Time-based loop: baseline signal recalc, inactivity scan, task refresh via full chain tail. */
export async function runDailyLoopForBlueprint(
  blueprintId: string,
  userId: string,
): Promise<void> {
  const archetype = await loadBlueprintArchetypeContext(blueprintId);
  const timeMult = archetype?.archetypeTimeframeMult ?? 1.0;
  const windowDays = archetypeSignalWindowDays(timeMult);
  logger.info(
    { blueprintId, timeMult, windowDays },
    "[DailyLoop] Archetype timeframe pressure — rolling window days",
  );

  await enterLoop({
    blueprintId,
    userId,
    trigger: "daily_cycle",
    generationMode: "daily",
  });
}

export async function runDailyLoopsForAllActiveBlueprints(): Promise<number> {
  const active = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  let count = 0;
  for (const bp of active) {
    try {
      await runDailyLoopForBlueprint(bp.id, bp.user_id);
      await writeEvent({
        eventType: EVENT_TYPES.INACTIVITY_SCAN_REQUESTED,
        entityType: "blueprint",
        entityId: bp.id,
        userId: bp.user_id,
        blueprintId: bp.id,
        payload: { trigger: "daily_cycle" },
        idempotencyKey: `inactivity_scan:${bp.id}:${new Date().toISOString().slice(0, 10)}`,
      }).catch(() => null);
      count++;
    } catch (err) {
      logger.error(
        { blueprintId: bp.id, err: err instanceof Error ? err.message : String(err) },
        "[DailyLoop] Blueprint daily cycle failed",
      );
    }
  }

  await scanForInactivity().catch(() => null);
  logger.info({ blueprintCount: count }, "[DailyLoop] Daily cycle complete");
  return count;
}

export function startDailyLoopScheduler(): void {
  const DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    void runDailyLoopsForAllActiveBlueprints();
  }, DAY_MS);
  logger.info("[DailyLoop] Scheduled daily execution loop (every 24 hours)");
}
