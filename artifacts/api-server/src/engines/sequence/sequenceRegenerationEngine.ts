/**
 * Prompt 6B — Sequences 18–24: execution → feedback → signals → condition → adaptation → regeneration.
 */
import {
  db,
  blueprints,
  conditions,
  miniPlanSequences,
  orders,
  plans,
  predictionSceneSequences,
  signalSnapshots,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { CONDITIONS, type Condition } from "../../constants/conditions.js";
import { SequenceTrackingService } from "../../services/SequenceTrackingService.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { BlueprintTierKey } from "../../types/blueprintSequences.js";
import { computeSceneFromBlueprint } from "./sequenceSceneEngine.js";
import { syncTaskGenerationSequence } from "./sequenceTaskQueueService.js";

const SIGNAL_LABELS = ["Foundation", "Operations", "Growth"] as const;

import {
  applyMiniPlanAllocation,
  getAllocationForCondition,
  mapPlanNameToMiniPlan,
} from "../mini-plan/MiniPlanAllocationEngine.js";
import {
  determineConditionFromFrameworkSignals,
  normalizeFrameworkSignals,
} from "../condition/ConditionDeterminationEngine.js";

function tierKey(tier?: string | null): BlueprintTierKey {
  if (tier === "growth" || tier === "ultimate") return tier;
  return "starter";
}

function determineCondition(signals: Record<string, number>): Condition {
  const framework = normalizeFrameworkSignals({
    Production: signals.Production ?? signals.Foundation ?? 0.5,
    Operations: signals.Operations ?? 0.5,
    Growth: signals.Growth ?? 0.5,
    Scale: signals.Scale ?? 0.5,
    momentum: signals.momentum,
  });
  return determineConditionFromFrameworkSignals(framework) as Condition;
}

async function readSignalValues(blueprintId: string): Promise<Record<string, number>> {
  const [snap] = await db
    .select()
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
    .limit(1);

  const om = (snap?.operational_mathematics_json ?? {}) as Record<string, unknown>;
  const scores = (om.scores ?? om) as Record<string, number> | undefined;

  const out: Record<string, number> = {
    Foundation: Number(
      scores?.foundation ?? scores?.production ?? scores?.completion_rate ?? snap?.completion_rate ?? 0.5,
    ),
    Production: Number(
      scores?.production ?? scores?.foundation ?? scores?.completion_rate ?? snap?.completion_rate ?? 0.5,
    ),
    Operations: Number(scores?.operations ?? scores?.consistency ?? snap?.consistency ?? 0.5),
    Growth: Number(scores?.growth ?? scores?.momentum ?? (snap?.momentum ?? 50) / 100),
    Scale: Number(scores?.scale ?? scores?.consistency ?? snap?.consistency ?? 0.5),
  };

  const orderRows = await db
    .select({ plan_id: orders.plan_id, status: orders.status })
    .from(orders)
    .where(eq(orders.blueprint_id, blueprintId));

  const planRows = await db.select({ id: plans.id, name: plans.name }).from(plans).where(eq(plans.blueprint_id, blueprintId));

  for (const label of SIGNAL_LABELS) {
    const streamPlans = planRows.filter((p) => mapPlanNameToMiniPlan(p.name) === label);
    if (streamPlans.length === 0) continue;
    const planIds = new Set(streamPlans.map((p) => p.id));
    const relevant = orderRows.filter((o) => o.plan_id && planIds.has(o.plan_id));
    if (relevant.length === 0) continue;
    const done = relevant.filter((o) => o.status === "completed").length;
    out[label] = Math.max(0.05, Math.min(0.95, done / relevant.length));
  }

  return out;
}

async function readCurrentCondition(blueprintId: string): Promise<Condition | null> {
  const [row] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
    .limit(1);
  return (row?.condition as Condition) ?? null;
}

async function adjustPlanAllocations(
  blueprintId: string,
  userId: string,
  condition: Condition,
  previousCondition: Condition | null,
) {
  const result = await applyMiniPlanAllocation({
    blueprintId,
    userId,
    condition,
    previousCondition,
    reason: "sequence_regeneration",
  });
  return Object.entries(result.allocation).map(([stream, percent]) => ({ stream, percent }));
}

export interface FeedbackRegenerationInput {
  blueprintId: string;
  userId: string;
  tier?: string | null;
  completion?: string;
  score?: number;
  reflection?: string;
}

export interface FeedbackRegenerationResult {
  conditionChanged: boolean;
  oldCondition: Condition | null;
  newCondition: Condition;
  signals: Record<string, number>;
  scenes: Awaited<ReturnType<typeof computeSceneFromBlueprint>>;
  allocationAdjusted: boolean;
  taskQueueSynced: boolean;
}

/** Full Prompt 6B + 34B loop after feedback submission. */
export async function processFeedbackRegeneration(
  input: FeedbackRegenerationInput,
): Promise<FeedbackRegenerationResult> {
  const t = tierKey(input.tier);
  const signals = await readSignalValues(input.blueprintId);
  const oldCondition = await readCurrentCondition(input.blueprintId);
  const newCondition = determineCondition(signals);
  const conditionChanged = oldCondition !== null && oldCondition !== newCondition;

  let allocationAdjusted = false;
  if (conditionChanged) {
    await adjustPlanAllocations(input.blueprintId, input.userId, newCondition, oldCondition);
    allocationAdjusted = true;

    await db
      .update(conditions)
      .set({ is_current: false })
      .where(and(eq(conditions.blueprint_id, input.blueprintId), eq(conditions.is_current, true)));

    await db.insert(conditions).values({
      blueprint_id: input.blueprintId,
      user_id: input.userId,
      condition: newCondition,
      reason: `Sequence regeneration: signals shifted to ${newCondition}`,
      source: "sequence_regeneration",
      is_current: true,
    });

    await db
      .update(blueprints)
      .set({ current_condition: newCondition })
      .where(eq(blueprints.id, input.blueprintId));

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "blueprint",
      entityId: input.blueprintId,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: {
        reason: "condition_changed",
        oldCondition,
        newCondition,
        allocation: getAllocationForCondition(newCondition),
      },
      idempotencyKey: `seq_regen:${input.blueprintId}:${newCondition}:${Date.now()}`,
    }).catch(() => null);
  }

  const scenes = await computeSceneFromBlueprint(input.blueprintId, newCondition, signals);

  await db
    .insert(predictionSceneSequences)
    .values({
      blueprint_id: input.blueprintId,
      current_scene: scenes.currentScene,
      expected_scene: scenes.expectedScene,
      ideal_scene: scenes.idealScene,
      projected_scene: scenes.projectedScene ?? null,
      scene_probability: scenes.sceneProbability ?? null,
      how_to_move_forward: scenes.howToMoveForward ?? null,
      regeneration_trigger: conditionChanged ? "condition_changed" : "feedback_submitted",
      next_orders: { refresh: true },
    })
    .onConflictDoUpdate({
      target: predictionSceneSequences.blueprint_id,
      set: {
        current_scene: scenes.currentScene,
        expected_scene: scenes.expectedScene,
        ideal_scene: scenes.idealScene,
        projected_scene: scenes.projectedScene ?? null,
        scene_probability: scenes.sceneProbability ?? null,
        how_to_move_forward: scenes.howToMoveForward ?? null,
        regeneration_trigger: conditionChanged ? "condition_changed" : "feedback_submitted",
      },
    });

  const taskQueue = await syncTaskGenerationSequence(input.blueprintId, t);

  await SequenceTrackingService.recordFeedbackLoop(input.blueprintId, t, {
    completion: input.completion,
    score: input.score,
    reflection: input.reflection,
    condition: newCondition,
    regenerationTrigger: conditionChanged ? "condition_changed" : "feedback_submitted",
  });

  return {
    conditionChanged,
    oldCondition,
    newCondition,
    signals,
    scenes,
    allocationAdjusted,
    taskQueueSynced: taskQueue.synced,
  };
}
