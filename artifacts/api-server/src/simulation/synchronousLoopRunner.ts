import { db, conditions, enforcementPackages, signalSnapshots } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { calculate } from "../engines/signal/SignalCalculationEngine.js";
import { evaluate } from "../engines/condition/ConditionEvaluationEngine.js";
import { generateEnforcementPackage } from "../engines/control/ControlEngine.js";
import { generate } from "../engines/task-generation/TaskGenerationEngine.js";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { processFeedback, type FeedbackInput } from "../engines/feedback/FeedbackProcessingEngine.js";
import { answerInterrogation } from "../engines/feedback/InterrogationService.js";
import { runDailyLoopForBlueprint } from "../engines/execution-loop/DailyLoopEngine.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";

export type SimCompletionStatus = FeedbackInput["completionStatus"];

export interface SimFeedbackInput {
  orderId: string;
  blueprintId: string;
  userId: string;
  completion: SimCompletionStatus;
  score: number;
  reflection: string;
  difficultyFelt?: string;
  hadBlocker?: boolean;
  blockerType?: string;
  blockerDetails?: string;
}

/** Runs signal → condition → control → task generation → guarantee (worker chain without pg-boss). */
export async function runSynchronousExecutionChain(
  blueprintId: string,
  userId: string,
  opts?: { executionLoop?: "primary" | "daily"; generationMode?: "post_feedback" | "daily" | "recovery" | "initial" },
) {
  const sig = await calculate({
    blueprintId,
    userId,
    executionLoop: opts?.executionLoop === "daily" ? "daily" : "primary",
  });

  const cond = await evaluate({
    blueprintId,
    userId,
    signalSnapshotId: sig.snapshotId,
    assignedCondition: sig.condition,
  });

  await generateEnforcementPackage({
    blueprintId,
    userId,
    conditionId: cond.conditionId,
    condition: cond.condition,
    signalSnapshotId: sig.snapshotId,
    escalationLevel: cond.escalationLevel,
    recoveryRequired: cond.recoveryRequired,
  });

  const gen = await generate({
    blueprintId,
    userId,
    generationMode: opts?.generationMode ?? "post_feedback",
    generationTrigger: opts?.generationMode === "daily" ? "daily_cycle" : "feedback_submitted",
  });

  const gu = await guaranteeTask({
    blueprintId,
    userId,
    generationMode: opts?.generationMode ?? "post_feedback",
    generationTrigger: opts?.generationMode === "daily" ? "daily_cycle" : "feedback_submitted",
  });

  return { sig, cond, gen, gu };
}

export async function waitForLoopCompletion(
  blueprintId: string,
  userId: string,
  _ms = 0,
): Promise<void> {
  await dispatchPendingEvents().catch(() => null);
  await runSynchronousExecutionChain(blueprintId, userId);
}

export async function submitSimFeedback(input: SimFeedbackInput): Promise<{
  feedbackId: string;
  requiresInterrogation: boolean;
  interrogationQuestion?: string;
}> {
  const blockerJson =
    input.hadBlocker && (input.blockerType || input.blockerDetails)
      ? {
          blocker_type: input.blockerType ?? "unknown",
          details: input.blockerDetails ?? "",
        }
      : {};

  const result = await processFeedback({
    orderId: input.orderId,
    userId: input.userId,
    blueprintId: input.blueprintId,
    completionStatus: input.completion,
    score: input.score,
    reflection: input.reflection,
    difficultyFelt: input.difficultyFelt,
    blockerJson,
    idempotencyKey: `sim:${input.orderId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  });

  if (!result.requiresInterrogation) {
    await runSynchronousExecutionChain(input.blueprintId, input.userId);
  }

  return {
    feedbackId: result.feedbackId,
    requiresInterrogation: result.requiresInterrogation,
    interrogationQuestion: result.interrogationQuestion,
  };
}

export async function submitInterrogationAnswer(
  feedbackId: string,
  userId: string,
  answer: string,
  blueprintId: string,
) {
  await answerInterrogation({
    feedbackId,
    userId,
    answer,
    idempotencyKey: `sim-interrogation:${feedbackId}`,
  });
  await runSynchronousExecutionChain(blueprintId, userId);
}

export async function triggerDailyCycle(blueprintId: string, userId: string) {
  await runDailyLoopForBlueprint(blueprintId, userId);
  await dispatchPendingEvents().catch(() => null);
  return runSynchronousExecutionChain(blueprintId, userId, {
    executionLoop: "daily",
    generationMode: "daily",
  });
}

export async function getCurrentCondition(blueprintId: string): Promise<string> {
  const [row] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
    .limit(1);
  return row?.condition ?? "nothingness";
}

export async function getCurrentSignals(blueprintId: string) {
  const [snap] = await db
    .select()
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
    .limit(1);
  return {
    momentum: snap?.momentum ?? 0,
    completionRate: snap?.completion_rate ?? 0,
    weightedScore: snap?.weighted_score ?? 0,
    assignedCondition: snap?.assigned_condition ?? "nothingness",
  };
}

export async function getCurrentEnforcement(blueprintId: string) {
  const [pkg] = await db
    .select()
    .from(enforcementPackages)
    .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)))
    .limit(1);
  const limits = (pkg?.task_limits ?? { min: 1, max: 3 }) as { min?: number; max?: number };
  return {
    difficultyCap: pkg?.difficulty_cap ?? "easy",
    taskLimits: { min: limits.min ?? 1, max: limits.max ?? 3 },
    condition: pkg?.condition ?? "nothingness",
  };
}
