/**
 * Daily task top-up — ensures active blueprints reach midpoint queue depth (5–8 contract).
 * Idempotency: task_generation_log.idempotency_key daily:{blueprintId}:{YYYY-MM-DD} UTC.
 */

import { logger } from "../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { BlueprintRouteService } from "../services/BlueprintRouteService.js";
import { parseTaskLimits, computeDailyMidpoint } from "../engines/task-generation/taskLimits.js";
import { db, enforcementPackages } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { OrderService } from "../services/OrderService.js";
import {
  dailyCycleIdempotencyKey,
  recordDailyCycleIdempotency,
  taskGenerationLogExists,
  todayUtcDateString,
} from "../services/TaskGenerationLogService.js";

const SKIP_STATUSES = new Set(["complete", "paused", "abandoned"]);

export async function topUpTasksForBlueprint(blueprint: {
  id: string;
  user_id: string;
  status: string | null;
  active: boolean | null;
}): Promise<{ generated: boolean; toGenerate: number }> {
  if (!blueprint.active) return { generated: false, toGenerate: 0 };
  if (blueprint.status && SKIP_STATUSES.has(blueprint.status)) {
    return { generated: false, toGenerate: 0 };
  }

  const dayKey = todayUtcDateString();
  const idempotencyKey = dailyCycleIdempotencyKey(blueprint.id, dayKey);

  if (await taskGenerationLogExists(idempotencyKey)) {
    logger.info(
      { blueprintId: blueprint.id, idempotencyKey },
      "[DailyCycle] Already ran today — skipping",
    );
    return { generated: false, toGenerate: 0 };
  }

  const [pkg] = await db
    .select({
      id: enforcementPackages.id,
      task_limits: enforcementPackages.task_limits,
      condition: enforcementPackages.condition,
    })
    .from(enforcementPackages)
    .where(
      and(
        eq(enforcementPackages.blueprint_id, blueprint.id),
        eq(enforcementPackages.is_current, true),
      ),
    )
    .limit(1);

  if (!pkg?.task_limits) {
    logger.warn({ blueprintId: blueprint.id }, "[DailyCycle] No enforcement package — skipping");
    return { generated: false, toGenerate: 0 };
  }

  const limits = parseTaskLimits(pkg.task_limits);
  const currentCount = await OrderService.countPendingAndActive(blueprint.id, blueprint.user_id);
  const conditionAtGeneration = pkg.condition ?? "stability";

  if (currentCount >= limits.min) {
    await recordDailyCycleIdempotency({
      blueprintId: blueprint.id,
      userId: blueprint.user_id,
      idempotencyKey,
      ordersGenerated: 0,
      conditionAtGeneration,
      enforcementPackageId: pkg.id,
    });
    logger.info(
      { blueprintId: blueprint.id, currentCount, taskMin: limits.min },
      "[DailyCycle] Sufficient tasks — recorded idempotency",
    );
    return { generated: false, toGenerate: 0 };
  }

  const midpoint = computeDailyMidpoint(limits);
  const toGenerate = Math.max(0, midpoint - currentCount);

  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "blueprint",
    entityId: blueprint.id,
    userId: blueprint.user_id,
    blueprintId: blueprint.id,
    payload: {
      trigger: "daily_cycle",
      generation_mode: "daily",
      targetCount: toGenerate,
      queue_fill: true,
    },
    idempotencyKey,
  }).catch(() => null);

  const result = await guaranteeTask({
    blueprintId: blueprint.id,
    userId: blueprint.user_id,
    generationMode: "daily",
    generationTrigger: "daily_cycle",
    targetCount: toGenerate,
    queueFill: true,
  });

  const ordersGenerated =
    result.state === "SYSTEM_LOCKED" ? 0 : Math.max(0, toGenerate);

  await recordDailyCycleIdempotency({
    blueprintId: blueprint.id,
    userId: blueprint.user_id,
    idempotencyKey,
    ordersGenerated,
    conditionAtGeneration,
    enforcementPackageId: pkg.id,
  });

  logger.info(
    { blueprintId: blueprint.id, toGenerate, state: result.state, ordersGenerated },
    "[DailyCycle] Top-up complete",
  );

  return { generated: result.state !== "SYSTEM_LOCKED", toGenerate };
}

export async function runDailyCycleForAllActiveBlueprints(): Promise<number> {
  const active = await BlueprintRouteService.getAllActiveBlueprints();
  let count = 0;
  for (const bp of active) {
    const r = await topUpTasksForBlueprint(bp).catch((err) => {
      logger.warn(
        { blueprintId: bp.id, err: err instanceof Error ? err.message : String(err) },
        "[DailyCycle] Blueprint top-up failed",
      );
      return { generated: false, toGenerate: 0 };
    });
    if (r.generated) count++;
  }
  return count;
}
