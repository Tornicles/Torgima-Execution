import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { and, eq } from "drizzle-orm";
import { blueprints, db, users } from "@workspace/db";
import { WorkerQueues } from "../types/eventContracts.js";
import { emitEvent, EVENT_TYPES } from "../services/EventService.js";
import { getTierConfig, normalizeBlueprintTier } from "../engines/blueprint/TierConfig.js";
import { clearBlueprintChain, buildChainFromTierConfig } from "../engines/blueprint/BlueprintChainGenerator.js";
import { fillBlueprintTaskQueue } from "../engines/task-engine/TaskEngine.js";

export const BLUEPRINT_EXECUTION_GENERATION_QUEUE = WorkerQueues.BLUEPRINT_EXECUTION_GENERATION;

workerRegistry.register({
  name: "BlueprintExecutionGenerationWorker",
  queue: BLUEPRINT_EXECUTION_GENERATION_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "BlueprintExecutionGenerationWorker", async (data) => {
        const { blueprintId, userId, eventId } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const [bp] = await db
          .select()
          .from(blueprints)
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
          .limit(1);
        if (!bp) return { success: false, retryable: false, reason: "Blueprint not found" };

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const tier = normalizeBlueprintTier(bp.tier ?? user?.tier ?? "starter");
        const tierConfig = getTierConfig(tier);

        await db.transaction(async (tx) => {
          await clearBlueprintChain(tx, blueprintId);

          const chain = await buildChainFromTierConfig(tx, {
            blueprintId,
            userId,
            goal: bp.goal ?? bp.raw_goal ?? "Execution goal",
            purpose: bp.purpose ?? null,
            tier,
            mode: (bp.mode ?? "individual") as "individual" | "team",
            tierConfig,
          });

          await tx
            .update(blueprints)
            .set({
              status: "active",
              active: true,
              dashboard_mode: "full_execution",
              execution_state: "active",
              current_plan_id: chain.planId,
              current_phase_id: chain.phaseId,
            })
            .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)));
        });

        // Generate initial task queue after structure exists.
        await fillBlueprintTaskQueue({
          blueprintId,
          userId,
          tier,
          generationMode: "initial",
          generationTrigger: "baseline_ready",
          causationEventId: eventId ?? undefined,
        });

        await emitEvent({
          eventType: EVENT_TYPES.BLUEPRINT_EXECUTION_GENERATION_COMPLETED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { tier, trigger: "baseline_ready" },
          idempotencyKey: `blueprint_execution_generation_completed:${blueprintId}`,
        }).catch(() => null);

        await emitEvent({
          eventType: EVENT_TYPES.EXECUTION_UNLOCKED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { execution_state: "active" },
          idempotencyKey: `execution_unlocked:${blueprintId}`,
        }).catch(() => null);

        return { success: true };
      });
    }
  },
});

