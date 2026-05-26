import type {
  EmotionalState,
  EngineMetrics,
  FrictionType,
  OutputType,
  ReflectionSignal,
  TaskRealityState,
} from "../../types/structured-feedback.js";
import {
  bundleToEngineMetrics,
  calculateFrameworkSignalsFromFeedback,
} from "../signal/FrameworkSignalCalculationEngine.js";
import type { feedback as feedbackTable } from "@workspace/db";

const TASK_WEIGHT: Record<TaskRealityState, number> = {
  Finished: 1,
  "Partly Done": 0.5,
  Started: 0.25,
  "Not Started": 0,
  Blocked: 0,
  Skipped: 0,
};

const OUTPUT_WEIGHTS: Record<OutputType, number> = {
  created: 0.2,
  published: 0.25,
  improved: 0.15,
  learned: 0.1,
  fixed: 0.15,
  no_tangible_output: 0,
};

const EMOTION_DELTA: Record<EmotionalState, number> = {
  Stressed: -0.2,
  Overwhelmed: -0.2,
  Tired: -0.1,
  Confused: -0.1,
  Distracted: -0.05,
  Calm: 0.1,
  Focused: 0.1,
  Good: 0.08,
  Excited: 0.15,
};

const FRICTION_DELTA: Record<FrictionType, number> = {
  not_enough_time: -0.15,
  low_energy: -0.15,
  task_too_hard: -0.1,
  confusing_unclear: -0.1,
  tool_tech_issue: -0.05,
  waiting_on_something: -0.08,
  fear_hesitation: -0.1,
  nothing_blocked: 0.1,
};

export function runCompletionEngine(
  taskStates: Array<{ state: TaskRealityState }>,
  assignedCount: number,
): number {
  const total = Math.max(assignedCount, taskStates.length, 1);
  const weighted = taskStates.reduce((sum, t) => sum + (TASK_WEIGHT[t.state] ?? 0), 0);
  return Math.min(1, weighted / total);
}

export function runOutputEngine(outputs: OutputType[]): number {
  if (outputs.includes("no_tangible_output") && outputs.length === 1) return 0;
  const sum = outputs.reduce((acc, o) => acc + (OUTPUT_WEIGHTS[o] ?? 0), 0);
  return Math.min(1, sum);
}

export function runExecutionQualityEngine(taskStates: Array<{ state: TaskRealityState }>): number {
  const total = Math.max(taskStates.length, 1);
  const partial = taskStates.filter((t) => t.state === "Partly Done" || t.state === "Started").length;
  const blocked = taskStates.filter((t) => t.state === "Blocked").length;
  const skipped = taskStates.filter((t) => t.state === "Skipped").length;
  const penalty = (partial + blocked + skipped) / total;
  return Math.max(0, Math.min(1, 1 - penalty));
}

export function runEnergyEngine(emotions: EmotionalState[], frictions: FrictionType[]): number {
  const emotionAvg =
    emotions.length === 0
      ? 0
      : emotions.reduce((s, e) => s + (EMOTION_DELTA[e] ?? 0), 0) / emotions.length;
  const frictionAvg =
    frictions.length === 0
      ? 0
      : frictions.reduce((s, f) => s + (FRICTION_DELTA[f] ?? 0), 0) / frictions.length;
  return Math.max(-1, Math.min(1, (emotionAvg + frictionAvg) / 2));
}

export function runReflectionEngine(reflection?: ReflectionSignal): number {
  if (!reflection) return 0;
  if (reflection === "yes_fine") return 0.1;
  if (reflection === "no_change") return -0.1;
  return 0;
}

export function runConfidenceEngine(sectionsCompleted: number): number {
  if (sectionsCompleted >= 6) return 0.9;
  if (sectionsCompleted === 5) return 0.75;
  if (sectionsCompleted === 4) return 0.6;
  return 0.4;
}

export function runFinalExecutionScore(parts: {
  completion: number;
  output: number;
  quality: number;
  energy: number;
  reflection: number;
  confidence: number;
}): number {
  const raw =
    parts.completion * 0.4 +
    parts.output * 0.2 +
    parts.quality * 0.15 +
    parts.energy * 0.1 +
    parts.reflection * 0.05 +
    parts.confidence * 0.1;
  return Math.max(0, Math.min(1, raw));
}

export function buildSignalSnapshot(
  metrics: {
    completion_rate: number;
    output_score: number;
    execution_quality: number;
    energy_score: number;
    reflection_score: number;
    confidence: number;
    final_execution_score: number;
    priorMomentum?: number;
  },
  taskStates?: Array<{ state: TaskRealityState }>,
): Pick<
  EngineMetrics,
  | "production_signal"
  | "operations_signal"
  | "growth_signal"
  | "scale_signal"
  | "momentum"
> {
  if (taskStates && taskStates.length > 0) {
    const pseudoRows = taskStates.map((t) => ({
      completion_status: taskStateToCompletionStatus(t.state),
      score: metrics.final_execution_score * 10,
      weighted_score: metrics.final_execution_score * 10,
      blocker_json: t.state === "Blocked" ? { blocked: true } : null,
      reflection:
        metrics.reflection_score > 0
          ? "Structured reflection captured"
          : metrics.reflection_score < 0
            ? "Needs change"
            : "",
    })) as (typeof feedbackTable.$inferSelect)[];
    const prior =
      metrics.priorMomentum != null
        ? { Production: metrics.priorMomentum, Operations: metrics.priorMomentum }
        : undefined;
    const bundle = calculateFrameworkSignalsFromFeedback(pseudoRows, prior);
    return bundleToEngineMetrics(bundle);
  }

  const production = Math.min(1, (metrics.completion_rate + metrics.output_score) / 2);
  const operations = Math.min(1, (metrics.execution_quality + (metrics.energy_score + 1) / 2) / 2);
  const growth = Math.min(
    1,
    Math.max(0, metrics.reflection_score + 0.5 + (metrics.output_score >= 0.1 ? 0.15 : 0)),
  );
  const scale = Math.min(1, (metrics.confidence + metrics.execution_quality) / 2);
  const momentum =
    metrics.priorMomentum != null ? metrics.final_execution_score - metrics.priorMomentum : 0;

  return {
    production_signal: production,
    operations_signal: operations,
    growth_signal: growth,
    scale_signal: scale,
    momentum,
  };
}

export function shouldShowReflectionSection(input: {
  completionRate: number;
  recentLowDays: number;
  momentum: number;
}): boolean {
  if (input.completionRate < 0.5) return true;
  if (input.recentLowDays >= 3) return true;
  if (input.momentum < -0.05) return true;
  return false;
}

export function countCompletedSections(session: {
  daily_reality?: unknown;
  reality_summary?: string | null;
  task_states?: unknown;
  emotional_state?: unknown;
  friction_type?: unknown;
  output_type?: unknown;
  reflection_signal?: string | null;
}): number {
  let n = 0;
  if (session.daily_reality || session.reality_summary?.trim()) n++;
  if (Array.isArray(session.task_states) && session.task_states.length > 0) n++;
  if (Array.isArray(session.emotional_state) && session.emotional_state.length > 0) n++;
  if (Array.isArray(session.friction_type) && session.friction_type.length > 0) n++;
  if (Array.isArray(session.output_type) && session.output_type.length > 0) n++;
  if (session.reflection_signal) n++;
  return n;
}

export function computeAllEngineMetrics(input: {
  taskStates: Array<{ state: TaskRealityState }>;
  assignedCount: number;
  outputs: OutputType[];
  emotions: EmotionalState[];
  frictions: FrictionType[];
  reflection?: ReflectionSignal;
  sectionsCompleted: number;
  priorExecutionScore?: number;
}): EngineMetrics {
  const completion_rate = runCompletionEngine(input.taskStates, input.assignedCount);
  const output_score = runOutputEngine(input.outputs);
  const execution_quality = runExecutionQualityEngine(input.taskStates);
  const energy_score = runEnergyEngine(input.emotions, input.frictions);
  const reflection_score = runReflectionEngine(input.reflection);
  const confidence = runConfidenceEngine(input.sectionsCompleted);
  const final_execution_score = runFinalExecutionScore({
    completion: completion_rate,
    output: output_score,
    quality: execution_quality,
    energy: energy_score,
    reflection: reflection_score,
    confidence,
  });
  const signals = buildSignalSnapshot(
    {
      completion_rate,
      output_score,
      execution_quality,
      energy_score,
      reflection_score,
      confidence,
      final_execution_score,
      priorMomentum: input.priorExecutionScore,
    },
    input.taskStates,
  );

  return {
    completion_rate,
    output_score,
    execution_quality,
    energy_score,
    reflection_score,
    confidence,
    final_execution_score,
    ...signals,
  };
}

export function taskStateToCompletionStatus(state: TaskRealityState): string {
  if (state === "Finished") return "completed";
  if (state === "Partly Done" || state === "Started") return "partial";
  if (state === "Blocked") return "failed";
  if (state === "Skipped") return "skipped";
  return "failed";
}

export function taskStateToOrderStatus(state: TaskRealityState): string {
  if (state === "Finished") return "completed";
  if (state === "Skipped") return "skipped";
  if (state === "Blocked") return "blocked";
  if (state === "Partly Done" || state === "Started") return "needs_feedback";
  return "pending";
}
