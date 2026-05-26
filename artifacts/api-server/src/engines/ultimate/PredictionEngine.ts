import { blueprints, db, orders, ultimatePredictions } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { ExecutionHistoryEntry, PredictionPayload } from "../../types/ultimate.js";
import { ULTIMATE_SEQUENCE_NUMBER } from "./ultimateGate.js";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

async function currentSequenceNumber(blueprintId: string): Promise<number> {
  const [row] = await db
    .select({ current_sequence_number: blueprints.current_sequence_number })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return row?.current_sequence_number ?? ULTIMATE_SEQUENCE_NUMBER;
}

function calculateCompletionRate(history: ExecutionHistoryEntry[]): number {
  const completed = history.filter((h) => h.completed).length;
  return completed / Math.max(history.length, 1);
}

function identifyCommonBlockers(history: ExecutionHistoryEntry[]): string[] {
  const blockers: Record<string, number> = {};
  for (const h of history) {
    for (const b of h.blockersEncountered) {
      if (b) blockers[b] = (blockers[b] ?? 0) + 1;
    }
  }
  return Object.entries(blockers)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([blocker]) => blocker);
}

function calculateAverageDuration(history: ExecutionHistoryEntry[]): number {
  const sum = history.reduce((s, h) => s + h.actualMinutes, 0);
  return sum / Math.max(history.length, 1);
}

function calculateTimingAccuracy(history: ExecutionHistoryEntry[]): number {
  const accuracies = history
    .filter((h) => h.actualMinutes > 0 && h.estimatedMinutes > 0)
    .map(
      (h) =>
        Math.min(h.estimatedMinutes, h.actualMinutes) /
        Math.max(h.estimatedMinutes, h.actualMinutes),
    );
  if (!accuracies.length) return 0.7;
  return accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
}

function compareBlockerLists(predicted: string[], actual: string[]): number {
  if (predicted.length === 0 && actual.length === 0) return 1;
  if (predicted.length === 0 || actual.length === 0) return 0;
  const matches = predicted.filter((p) =>
    actual.some((a) => a.toLowerCase().includes(p.toLowerCase())),
  ).length;
  return matches / Math.max(predicted.length, actual.length);
}

export const PredictionEngine = {
  async predictNextTask(
    blueprintId: string,
    executionHistory: ExecutionHistoryEntry[],
  ): Promise<PredictionPayload> {
    if (executionHistory.length === 0) {
      return {
        predicted_task: "Next goal checkpoint",
        task_confidence: 0.3,
        predicted_blockers: [],
        blocker_risk: 0.2,
        predicted_duration: 60,
      };
    }

    const completionRate = calculateCompletionRate(executionHistory);
    const commonBlockers = identifyCommonBlockers(executionHistory);
    const avgDuration = calculateAverageDuration(executionHistory);
    const timingAccuracy = calculateTimingAccuracy(executionHistory);

    const [nextOrder] = await db
      .select({ instruction: orders.instruction, title: orders.title })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          eq(orders.is_visible, true),
          inArray(orders.status, ["pending", "active", "needs_feedback"]),
        ),
      )
      .orderBy(orders.created_at)
      .limit(1);

    return {
      predicted_task: nextOrder?.instruction ?? nextOrder?.title ?? "Next goal checkpoint",
      task_confidence: clamp01(completionRate),
      predicted_blockers: commonBlockers,
      blocker_risk: clamp01(Math.min(commonBlockers.length * 0.3, 1)),
      predicted_duration: Math.round(avgDuration * (2 - timingAccuracy)) || 45,
    };
  },

  async recordPrediction(blueprintId: string, prediction: PredictionPayload) {
    const [row] = await db
      .insert(ultimatePredictions)
      .values({
        blueprint_id: blueprintId,
        sequence_number: await currentSequenceNumber(blueprintId),
        predicted_task: prediction.predicted_task,
        predicted_blockers: prediction.predicted_blockers,
        predicted_duration: prediction.predicted_duration,
        task_confidence: clamp01(prediction.task_confidence),
        blocker_risk: clamp01(prediction.blocker_risk),
        accuracy_history: 0.5,
      })
      .returning();
    return row!;
  },

  async validatePrediction(
    predictionId: string,
    actual: { actual_task: string; actual_blockers: string[] },
  ) {
    const [pred] = await db
      .select()
      .from(ultimatePredictions)
      .where(eq(ultimatePredictions.id, predictionId))
      .limit(1);

    if (!pred) throw new Error("Prediction not found");

    const taskMatch = pred.predicted_task
      .toLowerCase()
      .includes(actual.actual_task.toLowerCase().slice(0, 40));
    const blockersMatch = compareBlockerLists(pred.predicted_blockers ?? [], actual.actual_blockers);
    const correctness = taskMatch && blockersMatch > 0.5;

    const oldAccuracy = pred.accuracy_history ?? 0.5;
    const newAccuracy = oldAccuracy * 0.7 + (correctness ? 1 : 0) * 0.3;

    const [updated] = await db
      .update(ultimatePredictions)
      .set({
        actual_task: actual.actual_task,
        actual_blockers: actual.actual_blockers,
        prediction_correct: correctness,
        accuracy_history: clamp01(newAccuracy),
        validated_at: new Date(),
      })
      .where(eq(ultimatePredictions.id, predictionId))
      .returning();

    return updated!;
  },

  async getPredictionAccuracy(blueprintId: string) {
    const predictions = await db
      .select()
      .from(ultimatePredictions)
      .where(
        and(
          eq(ultimatePredictions.blueprint_id, blueprintId),
          isNotNull(ultimatePredictions.prediction_correct),
        ),
      )
      .orderBy(desc(ultimatePredictions.created_at));

    const correct = predictions.filter((p) => p.prediction_correct).length;
    const recent = predictions.slice(0, 10);
    const recentCorrect = recent.filter((p) => p.prediction_correct).length;

    return {
      total_predictions: predictions.length,
      correct,
      accuracy: predictions.length > 0 ? correct / predictions.length : 0,
      recent_accuracy: recent.length > 0 ? recentCorrect / recent.length : 0,
    };
  },

  async buildHistoryFromOrders(blueprintId: string): Promise<ExecutionHistoryEntry[]> {
    const rows = await db
      .select({
        instruction: orders.instruction,
        time_estimate_minutes: orders.time_estimate_minutes,
        status: orders.status,
        blocker_type: orders.blocker_type,
      })
      .from(orders)
      .where(eq(orders.blueprint_id, blueprintId))
      .orderBy(desc(orders.completed_at))
      .limit(20);

    return rows.map((o) => ({
      taskName: o.instruction,
      estimatedMinutes: o.time_estimate_minutes ?? 45,
      actualMinutes: o.time_estimate_minutes ?? 45,
      completed: o.status === "completed",
      blockersEncountered: o.blocker_type ? [o.blocker_type] : [],
    }));
  },
};
