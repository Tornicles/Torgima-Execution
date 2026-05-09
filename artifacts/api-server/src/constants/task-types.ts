export const TASK_TYPES = {
  ACTION: "action",
  RESEARCH: "research",
  REVIEW: "review",
  HABIT: "habit",
  MILESTONE: "milestone",
  CHECKPOINT: "checkpoint",
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  action: "Action — Do something concrete",
  research: "Research — Learn or investigate",
  review: "Review — Reflect and assess",
  habit: "Habit — Daily practice",
  milestone: "Milestone — Major completion point",
  checkpoint: "Checkpoint — Phase gate",
};

export const DEFAULT_ESTIMATED_MINUTES: Record<TaskType, number> = {
  action: 45,
  research: 30,
  review: 20,
  habit: 15,
  milestone: 60,
  checkpoint: 30,
};
