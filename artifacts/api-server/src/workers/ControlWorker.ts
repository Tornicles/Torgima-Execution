import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { db, conditions as conditionsTable, enforcementPackages } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";

// ControlWorker — bridges condition_evaluated to a fresh enforcement_packages
// row, then emits enforcement_package_created which routes via the dispatcher
// to the task_generation_requested queue.
//
// Real ControlEngine / EnforcementPackageGenerator lands in Prompt 7; the
// worker writes a deterministic per-condition default package so downstream
// workers always have a current package to honor.
//
// Spec: Prompt 6 §STEP 3 (ControlWorker), DOC_04 §7.

export const CONTROL_QUEUE = "enforcement_package_requested";

type ConditionName =
  | "nothingness"
  | "danger"
  | "urgency"
  | "stability"
  | "power"
  | "affluence"
  | "power_change";

interface DefaultLimits {
  taskLimits: { min: number; max: number };
  difficultyCap: "very_easy" | "easy" | "moderate" | "hard";
  allowedActions: string[];
  blockedActions: string[];
  phasePermission: "blocked" | "restricted" | "normal" | "accelerated";
  riskLevel: "low" | "medium" | "high" | "critical";
}

const DEFAULTS: Record<ConditionName, DefaultLimits> = {
  nothingness: {
    taskLimits: { min: 1, max: 2 },
    difficultyCap: "easy",
    allowedActions: ["task", "recovery"],
    blockedActions: ["scale"],
    phasePermission: "restricted",
    riskLevel: "low",
  },
  danger: {
    taskLimits: { min: 1, max: 1 },
    difficultyCap: "very_easy",
    allowedActions: ["recovery"],
    blockedActions: ["scale", "phase_advance"],
    phasePermission: "blocked",
    riskLevel: "critical",
  },
  urgency: {
    taskLimits: { min: 1, max: 2 },
    difficultyCap: "easy",
    allowedActions: ["task", "recovery"],
    blockedActions: ["scale"],
    phasePermission: "restricted",
    riskLevel: "high",
  },
  stability: {
    taskLimits: { min: 2, max: 3 },
    difficultyCap: "moderate",
    allowedActions: ["task", "phase_advance"],
    blockedActions: [],
    phasePermission: "normal",
    riskLevel: "medium",
  },
  power: {
    taskLimits: { min: 2, max: 4 },
    difficultyCap: "hard",
    allowedActions: ["task", "phase_advance", "scale"],
    blockedActions: [],
    phasePermission: "accelerated",
    riskLevel: "low",
  },
  affluence: {
    taskLimits: { min: 2, max: 4 },
    difficultyCap: "hard",
    allowedActions: ["task", "phase_advance", "scale"],
    blockedActions: [],
    phasePermission: "accelerated",
    riskLevel: "low",
  },
  power_change: {
    taskLimits: { min: 1, max: 2 },
    difficultyCap: "moderate",
    allowedActions: ["task", "recovery"],
    blockedActions: ["scale"],
    phasePermission: "normal",
    riskLevel: "medium",
  },
};

function defaultsFor(condition: string): DefaultLimits {
  return DEFAULTS[condition as ConditionName] ?? DEFAULTS.urgency;
}

workerRegistry.register({
  name: "ControlWorker",
  queue: CONTROL_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ControlWorker", async (data) => {
        const { blueprintId, userId } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId" };
        }

        const [condition] = await db
          .select()
          .from(conditionsTable)
          .where(
            and(
              eq(conditionsTable.blueprint_id, blueprintId),
              eq(conditionsTable.is_current, true),
            ),
          )
          .limit(1);

        const conditionName = condition?.condition ?? "urgency";
        const defaults = defaultsFor(conditionName);

        await db
          .update(enforcementPackages)
          .set({ is_current: false })
          .where(
            and(
              eq(enforcementPackages.blueprint_id, blueprintId),
              eq(enforcementPackages.is_current, true),
            ),
          );

        const [pkg] = await db
          .insert(enforcementPackages)
          .values({
            blueprint_id: blueprintId,
            condition_id: condition?.id ?? (null as unknown as undefined),
            condition: conditionName,
            task_limits: defaults.taskLimits,
            difficulty_cap: defaults.difficultyCap,
            allowed_actions: defaults.allowedActions,
            blocked_actions: defaults.blockedActions,
            phase_permission: defaults.phasePermission,
            ai_mode: "command",
            ui_mode: "standard",
            feature_permissions: {},
            risk_level: defaults.riskLevel,
            is_current: true,
          })
          .returning({ id: enforcementPackages.id });

        if (!pkg) {
          return { success: false, retryable: true, reason: "Failed to create enforcement package" };
        }

        await incrementStateVersion(blueprintId, "enforcement_package_created", data.eventId);

        // Continue chain — enforcement_package_created → task_generation_requested
        await writeEvent({
          eventType: EVENT_TYPES.ENFORCEMENT_PACKAGE_CREATED,
          entityType: "enforcement_package",
          entityId: pkg.id,
          userId,
          blueprintId,
          payload: {
            enforcement_package_id: pkg.id,
            generation_mode: "post_feedback",
            generation_trigger: "enforcement_package_created",
          },
          idempotencyKey: `task_gen:${blueprintId}:${pkg.id}`,
          causationEventId: data.eventId,
        });

        logger.info(
          { blueprintId, pkgId: pkg.id, condition: conditionName },
          "[ControlWorker] Enforcement package created (stub)",
        );
        return { success: true };
      });
    }
  },
});
