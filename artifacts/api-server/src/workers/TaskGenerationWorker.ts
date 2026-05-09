import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { db, blueprints, enforcementPackages, orders } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";

// TaskGenerationWorker — bridges task_generation_requested to a pending Order
// (using a placeholder template when none exist), then emits
// task_generation_completed and projection_refresh_requested.
//
// Real TaskGenerationEngine lands in Prompt 8; this worker enforces the
// "loop never goes empty" guarantee by inserting at least one pending task
// when active blueprints have none.
//
// Spec: Prompt 6 §STEP 3 (TaskGenerationWorker), DOC_04 §8 (ContinuousTaskGuarantee).

export const TASK_GENERATION_QUEUE = "task_generation_requested";

workerRegistry.register({
  name: "TaskGenerationWorker",
  queue: TASK_GENERATION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "TaskGenerationWorker", async (data) => {
        const { blueprintId, userId, payload } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId" };
        }

        const [{ count } = { count: 0 }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(
            and(eq(orders.blueprint_id, blueprintId), inArray(orders.status, ["pending", "active"])),
          );

        const existingTasks = count ?? 0;

        if (existingTasks > 0) {
          logger.info(
            { blueprintId, existingCount: existingTasks },
            "[TaskGenerationWorker] Tasks already exist — skipping generation",
          );
        } else {
          const [blueprint] = await db
            .select({ goal: blueprints.goal, current_domain: blueprints.current_domain })
            .from(blueprints)
            .where(eq(blueprints.id, blueprintId))
            .limit(1);

          const [enforcement] = await db
            .select({ id: enforcementPackages.id, difficulty_cap: enforcementPackages.difficulty_cap })
            .from(enforcementPackages)
            .where(
              and(
                eq(enforcementPackages.blueprint_id, blueprintId),
                eq(enforcementPackages.is_current, true),
              ),
            )
            .limit(1);

          const goalShort = blueprint?.goal ? blueprint.goal.slice(0, 60) : "your goal";

          await db.insert(orders).values({
            blueprint_id: blueprintId,
            user_id: userId,
            task_type: "execution",
            title: `Next action toward: ${goalShort}`,
            instruction:
              "Complete the next concrete step toward your goal. Be specific about what you will do, how long it will take, and how you will know it is done.",
            expected_output: "A concrete deliverable or completed action.",
            definition_of_done:
              "The stated action has been completed and you can describe what changed as a result.",
            why_it_matters: "Every step forward builds execution momentum.",
            difficulty: enforcement?.difficulty_cap ?? "easy",
            priority: 5,
            domain: blueprint?.current_domain ?? "delivery",
            enforcement_package_id: enforcement?.id ?? (null as unknown as undefined),
            generation_reason: `${(payload as Record<string, unknown> | undefined)?.["generation_trigger"] ?? "task_generation"} — stub`,
            status: "pending",
          });

          logger.info({ blueprintId }, "[TaskGenerationWorker] Placeholder task generated (stub)");
        }

        await incrementStateVersion(blueprintId, "task_generation_completed", data.eventId);

        await writeEvent({
          eventType: EVENT_TYPES.TASK_GENERATION_COMPLETED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: {
            generation_mode: (payload as Record<string, unknown> | undefined)?.["generation_mode"],
          },
          idempotencyKey: `task_gen_complete:${blueprintId}:${data.eventId ?? Date.now()}`,
          causationEventId: data.eventId,
        });

        await writeEvent({
          eventType: EVENT_TYPES.PROJECTION_REFRESH_REQUESTED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: {},
          idempotencyKey: `proj_refresh:${blueprintId}:${Date.now()}`,
          causationEventId: data.eventId,
        });

        return { success: true };
      });
    }
  },
});
