/** CONDITION_SYSTEM_SPECIFICATION.md — per-condition task queue bounds (5–8 daily operating target). */

export const CONDITION_TASK_LIMITS = {
  nothingness: { min: 2, max: 3 },
  danger: { min: 2, max: 3 },
  urgency: { min: 3, max: 5 },
  stability: { min: 5, max: 7 },
  power: { min: 6, max: 8 },
  affluence: { min: 6, max: 8 },
  power_change: { min: 3, max: 5 },
} as const;

/** @deprecated Use CONDITION_TASK_LIMITS — kept for imports expecting daily cap number. */
export const DAILY_TASKS_BY_CONDITION: Record<string, number> = Object.fromEntries(
  Object.entries(CONDITION_TASK_LIMITS).map(([k, v]) => [k, Math.floor((v.min + v.max) / 2)]),
);

export function taskLimitsForCondition(condition: string): { min: number; max: number } {
  const key = condition.toLowerCase().replace(/\s+/g, "_");
  return CONDITION_TASK_LIMITS[key as keyof typeof CONDITION_TASK_LIMITS] ?? CONDITION_TASK_LIMITS.stability;
}

/** Midpoint of min/max — used for daily visibility scheduling and queue snapshots. */
export function dailyTasksForCondition(condition: string): number {
  const { min, max } = taskLimitsForCondition(condition);
  return Math.floor((min + max) / 2);
}
