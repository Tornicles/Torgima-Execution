/** DOC19 — nine verified reward types. */

export type RewardType =
  | "COMPLETION"
  | "CONSISTENCY"
  | "RECOVERY"
  | "CAPABILITY_GROWTH"
  | "IDENTITY_ALIGNMENT"
  | "MILESTONE"
  | "OUTCOME_TRUTH"
  | "HONEST_FAILURE"
  | "FOCUS_PROTECTION";

export type RewardIntensity = "LOW" | "MEDIUM" | "HIGH";

export const REWARD_TYPES: RewardType[] = [
  "COMPLETION",
  "CONSISTENCY",
  "RECOVERY",
  "CAPABILITY_GROWTH",
  "IDENTITY_ALIGNMENT",
  "MILESTONE",
  "OUTCOME_TRUTH",
  "HONEST_FAILURE",
  "FOCUS_PROTECTION",
];

export type RewardSourceType =
  | "FEEDBACK"
  | "SIGNAL"
  | "INACTIVITY"
  | "CAPABILITY"
  | "IDENTITY"
  | "MILESTONE"
  | "OUTCOME"
  | "TASK_GENERATION";
