export const CONDITIONS = {
  OPTIMAL: "optimal",
  BUILDING: "building",
  RECOVERING: "recovering",
  CRITICAL: "critical",
  BLOCKED: "blocked",
} as const;

export type Condition = (typeof CONDITIONS)[keyof typeof CONDITIONS];

export const CONDITION_RULES: Record<
  Condition,
  { maxDailyTasks: number; allowedTypes: string[]; label: string }
> = {
  optimal: {
    maxDailyTasks: 5,
    allowedTypes: ["action", "research", "review", "habit", "milestone"],
    label: "You are in optimal condition. Full execution capacity.",
  },
  building: {
    maxDailyTasks: 4,
    allowedTypes: ["action", "research", "habit"],
    label: "Momentum is building. Keep steady.",
  },
  recovering: {
    maxDailyTasks: 3,
    allowedTypes: ["habit", "review", "action"],
    label: "In recovery. Lighter load enforced.",
  },
  critical: {
    maxDailyTasks: 2,
    allowedTypes: ["habit", "review"],
    label: "Critical signals. Minimum viable execution.",
  },
  blocked: {
    maxDailyTasks: 1,
    allowedTypes: ["review"],
    label: "System blocked. Review and reset required.",
  },
};
