/** CONDITION_SYSTEM_SPECIFICATION.md — daily task caps per condition. */

export const DAILY_TASKS_BY_CONDITION: Record<string, number> = {
  nothingness: 3,
  danger: 3,
  urgency: 6,
  stability: 9,
  power: 12,
  affluence: 12,
  power_change: 6,
};

export function dailyTasksForCondition(condition: string): number {
  const key = condition.toLowerCase().replace(/\s+/g, "_");
  return DAILY_TASKS_BY_CONDITION[key] ?? DAILY_TASKS_BY_CONDITION.stability;
}
