/** Condition-based task queue bounds (enforcement package + task generation). */
import { CONDITION_TASK_LIMITS, taskLimitsForCondition } from "../../constants/conditionSpec.js";

export { CONDITION_TASK_LIMITS, taskLimitsForCondition };

const DEFAULT_LIMITS = CONDITION_TASK_LIMITS.stability;

export function parseTaskLimits(raw: unknown): { min: number; max: number } {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LIMITS };
  const o = raw as Record<string, unknown>;
  const nested =
    o.taskLimit && typeof o.taskLimit === "object"
      ? (o.taskLimit as { min?: unknown; max?: unknown })
      : null;
  const min = Number(nested?.min ?? o.min ?? DEFAULT_LIMITS.min);
  const max = Number(nested?.max ?? o.max ?? DEFAULT_LIMITS.max);
  return {
    min: Number.isFinite(min) ? Math.max(1, Math.round(min)) : DEFAULT_LIMITS.min,
    max: Number.isFinite(max) ? Math.max(1, Math.round(max)) : DEFAULT_LIMITS.max,
  };
}

export function applyArchetypeTaskLimits(
  condition: string,
  archetypeExecutionMult?: number | null,
): { min: number; max: number } {
  const base = taskLimitsForCondition(condition);
  const mult = archetypeExecutionMult ?? 1;
  const taskMin = Math.max(1, Math.round(base.min * mult));
  const taskMax = Math.min(8, Math.round(base.max * mult));
  return { min: Math.min(taskMin, taskMax), max: Math.max(taskMin, taskMax) };
}

/** Target batch size for a generation cycle (not cumulative daily total). */
export function selectTaskCount(params: {
  task_limits: { min: number; max: number };
  current_streak: number;
  generation_mode: string;
}): number {
  const { task_limits, current_streak, generation_mode } = params;

  if (generation_mode === "initial") {
    return Math.min(3, task_limits.max);
  }

  if (generation_mode === "recovery") {
    return task_limits.min;
  }

  if (generation_mode === "daily") {
    return computeDailyMidpoint(task_limits);
  }

  const streakBonus = Math.floor(current_streak / 3);
  const target = task_limits.min + streakBonus;
  return Math.max(task_limits.min, Math.min(target, task_limits.max));
}

export function computeDailyMidpoint(limits: { min: number; max: number }): number {
  return Math.floor((limits.min + limits.max) / 2);
}

export function computeAdditionalTasksToGenerate(args: {
  pendingCount: number;
  min: number;
  max: number;
  generationMode: string;
  generationTrigger: string;
  queueFill?: boolean;
  targetCount?: number;
  generatedThisInvocation: number;
  currentStreak?: number;
}): number {
  const {
    pendingCount,
    min,
    max,
    generationMode,
    generationTrigger,
    queueFill,
    targetCount,
    generatedThisInvocation,
    currentStreak = 0,
  } = args;

  if (pendingCount >= max) return 0;

  const initial =
    generationMode === "initial" ||
    generationTrigger === "blueprint_launched" ||
    generationTrigger === "blueprint_launch";

  const isDaily =
    generationMode === "daily" ||
    generationTrigger === "daily_cycle" ||
    generationTrigger === "daily_visibility_cycle";

  const fill =
    queueFill ||
    generationTrigger === "guarantee_check" ||
    generationTrigger === "guarantee_worker" ||
    generationTrigger === "manual_force" ||
    generationTrigger === "api_guarantee";

  if (initial) {
    const want = selectTaskCount({
      task_limits: { min, max },
      current_streak: currentStreak,
      generation_mode: "initial",
    });
    return Math.max(0, Math.min(want - generatedThisInvocation, max - pendingCount));
  }

  if (isDaily) {
    const midpoint = computeDailyMidpoint({ min, max });
    if (pendingCount >= midpoint && pendingCount >= min) return 0;
    const target = targetCount ?? midpoint;
    return Math.max(0, Math.min(target - pendingCount - generatedThisInvocation, max - pendingCount));
  }

  if (targetCount != null) {
    return Math.max(0, Math.min(targetCount - generatedThisInvocation, max - pendingCount));
  }

  if (fill || pendingCount < min) {
    const want = selectTaskCount({
      task_limits: { min, max },
      current_streak: currentStreak,
      generation_mode: generationMode,
    });
    return Math.max(0, Math.min(want - generatedThisInvocation, max - pendingCount));
  }

  if (generatedThisInvocation >= 1) return 0;
  return Math.min(1, max - pendingCount);
}
