import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { BlueprintStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

// ExecutionLoopEngine — orchestrator. All loop entries flow through enterLoop().
// Routes triggers to the correct point in the engine chain. Owns routing and
// state coordination only — does not implement engine-specific logic.
//
// Spec: Prompt 6 §STEP 2, DOC_04 §2.1–2.2, SPEC_EXEC_LOOP §3.

export type LoopEntryTrigger =
  | "blueprint_launched"
  | "feedback_submitted"
  | "inactivity_detected"
  | "daily_cycle"
  | "condition_change"
  | "phase_completed"
  | "manual_regeneration"
  | "resume";

export type GenerationMode =
  | "initial"
  | "post_feedback"
  | "daily"
  | "recovery"
  | "condition_change";

export interface LoopEntryParams {
  blueprintId: string;
  userId: string;
  trigger: LoopEntryTrigger;
  generationMode?: GenerationMode;
  causationEventId?: string;
  payload?: Record<string, unknown>;
}

// Loop entry point. Verifies the blueprint is eligible, then emits the right
// downstream event so the worker chain takes over.
export async function enterLoop(params: LoopEntryParams): Promise<void> {
  const { blueprintId, userId, trigger } = params;

  logger.info({ blueprintId, trigger }, "[ExecutionLoop] Entry");

  const [blueprint] = await db
    .select({
      id: blueprints.id,
      status: blueprints.status,
      state_version: blueprints.state_version,
    })
    .from(blueprints)
    .where(
      and(
        eq(blueprints.id, blueprintId),
        eq(blueprints.user_id, userId),
        eq(blueprints.active, true),
      ),
    )
    .limit(1);

  if (!blueprint) {
    logger.warn(
      { blueprintId, trigger },
      "[ExecutionLoop] Blueprint not active — skipping",
    );
    return;
  }

  if (blueprint.status === BlueprintStatus.PAUSED) {
    logger.info({ blueprintId }, "[ExecutionLoop] Blueprint paused — skipping");
    return;
  }

  if (blueprint.status === BlueprintStatus.COMPLETE || blueprint.status === BlueprintStatus.ABANDONED) {
    logger.info({ blueprintId }, "[ExecutionLoop] Blueprint terminal — skipping");
    return;
  }

  const mode = params.generationMode ?? deriveMode(trigger);

  switch (trigger) {
    case "blueprint_launched":
    case "manual_regeneration":
    case "resume":
      await emitTaskGenerationRequest(
        blueprintId,
        userId,
        trigger,
        mode,
        params.causationEventId,
      );
      break;

    case "daily_cycle":
      await emitSignalRecalculation(blueprintId, userId, params.causationEventId, "daily");
      break;

    case "feedback_submitted":
      // Full chain: signal → condition → control → task
      await emitSignalRecalculation(blueprintId, userId, params.causationEventId);
      break;

    case "inactivity_detected":
      // Recovery path: skip signal recalc, go to recovery task generation
      await emitTaskGenerationRequest(
        blueprintId,
        userId,
        trigger,
        "recovery",
        params.causationEventId,
      );
      break;

    case "condition_change":
      // Control recalculation needed
      await emitEnforcementRequest(blueprintId, userId, params.causationEventId);
      break;

    case "phase_completed":
      await emitTaskGenerationRequest(
        blueprintId,
        userId,
        trigger,
        "post_feedback",
        params.causationEventId,
      );
      break;

    default:
      await emitTaskGenerationRequest(
        blueprintId,
        userId,
        trigger,
        mode,
        params.causationEventId,
      );
  }
}

// ── CHAIN EMISSION HELPERS ────────────────────────────────────────────────────

async function emitSignalRecalculation(
  blueprintId: string,
  userId: string,
  causationEventId?: string,
  executionLoop: "primary" | "daily" = "primary",
): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { trigger: "execution_loop", execution_loop: executionLoop },
    idempotencyKey: `signal_recalc:${blueprintId}:${Date.now()}`,
    causationEventId,
  });
}

async function emitEnforcementRequest(
  blueprintId: string,
  userId: string,
  causationEventId?: string,
): Promise<void> {
  // condition_evaluated → enforcement_package_requested queue (per EventDispatcher map)
  await writeEvent({
    eventType: EVENT_TYPES.CONDITION_EVALUATED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { trigger: "condition_change" },
    idempotencyKey: `enforcement_req:${blueprintId}:${Date.now()}`,
    causationEventId,
  });
}

async function emitTaskGenerationRequest(
  blueprintId: string,
  userId: string,
  trigger: string,
  mode: string,
  causationEventId?: string,
): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { generation_mode: mode, generation_trigger: trigger },
    idempotencyKey: `task_gen:${blueprintId}:${trigger}:${Date.now()}`,
    causationEventId,
  });
}

function deriveMode(trigger: LoopEntryTrigger): GenerationMode {
  const modes: Record<LoopEntryTrigger, GenerationMode> = {
    blueprint_launched: "initial",
    feedback_submitted: "post_feedback",
    inactivity_detected: "recovery",
    daily_cycle: "daily",
    condition_change: "condition_change",
    phase_completed: "post_feedback",
    manual_regeneration: "post_feedback",
    resume: "post_feedback",
  };
  return modes[trigger] ?? "post_feedback";
}

// Legacy class export retained for backwards compatibility with earlier prompts.
export class ExecutionLoopEngine {
  async runLoop(blueprintId: string, userId: string): Promise<void> {
    await enterLoop({ blueprintId, userId, trigger: "manual_regeneration" });
  }

  async enterLoop(params: LoopEntryParams): Promise<void> {
    await enterLoop(params);
  }
}
