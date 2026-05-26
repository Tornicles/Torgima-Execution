import type { BlueprintSequenceName } from "./blueprintSequences.js";

export type BlueprintTierLabel = "Starter" | "Growth" | "Ultimate";

export interface SequenceCheckpointDef {
  number: number;
  name: string;
  tier: BlueprintTierLabel;
  unlocksAfter?: number;
  requiresTier?: BlueprintTierLabel;
}

export interface SequenceStatusItem {
  number: number;
  name: string;
  tier: BlueprintTierLabel;
  completed: boolean;
  locked: boolean;
  completedAt?: string;
  durationMs?: number | null;
  validation: {
    passed: boolean;
    errors: string[];
  };
}

export interface SequenceAuditEntry {
  timestamp: string;
  sequence: number;
  action: string;
  reason: string;
}

/** All 25 numbered blueprint sequences — CURSOR_PROMPT_1 */
export const ALL_SEQUENCES: Record<number, SequenceCheckpointDef> = {
  1: { number: 1, name: "Goal Intake", tier: "Starter" },
  2: { number: 2, name: "Purpose Definition", tier: "Starter" },
  3: { number: 3, name: "Context Capture", tier: "Starter" },
  4: { number: 4, name: "ERECTOR Validation", tier: "Starter" },
  5: { number: 5, name: "Validation Results", tier: "Starter" },
  6: { number: 6, name: "Blueprint Tier Selection", tier: "Starter" },
  7: { number: 7, name: "Policy System", tier: "Starter" },
  8: { number: 8, name: "Blueprint Build", tier: "Starter" },
  9: { number: 9, name: "Master Plan", tier: "Starter" },
  10: { number: 10, name: "Permanent Signals", tier: "Starter" },
  11: { number: 11, name: "Mini Plans", tier: "Starter" },
  12: { number: 12, name: "Programs", tier: "Starter" },
  13: { number: 13, name: "Phases", tier: "Starter" },
  14: { number: 14, name: "Projects", tier: "Starter" },
  15: { number: 15, name: "Actions", tier: "Starter" },
  16: { number: 16, name: "Task Generation", tier: "Starter" },
  17: { number: 17, name: "Orders (Visible Tasks)", tier: "Starter" },
  18: { number: 18, name: "Execution Loop", tier: "Starter" },
  19: { number: 19, name: "Feedback Submission", tier: "Starter" },
  20: { number: 20, name: "Signal Calculation", tier: "Starter" },
  21: { number: 21, name: "Condition Assignment", tier: "Starter" },
  22: { number: 22, name: "Control Engine", tier: "Starter" },
  23: { number: 23, name: "Continuous Task Guarantee", tier: "Starter" },
  24: {
    number: 24,
    name: "Growth Intelligence",
    tier: "Growth",
    unlocksAfter: 23,
    requiresTier: "Growth",
  },
  25: {
    number: 25,
    name: "Ultimate Prediction & Scene",
    tier: "Ultimate",
    unlocksAfter: 24,
    requiresTier: "Ultimate",
  },
};

/** Maps collapsed canonical sequence names → numbered sequence (1–25). */
export const CANONICAL_TO_SEQUENCE_NUMBER: Partial<Record<BlueprintSequenceName, number>> = {
  GOAL: 1,
  PURPOSE: 2,
  CONTEXT: 3,
  VALIDATION: 4,
  VALIDATION_RESULT: 5,
  BLUEPRINT_TIER: 6,
  POLICY: 7,
  MASTER_PLAN: 9,
  SIGNAL: 10,
  MINI_PLAN: 11,
  EXECUTION_STRUCTURE: 12,
  TASK_GENERATION: 16,
  EXECUTION_FEEDBACK: 19,
  SIGNAL_CONDITION: 21,
  ADAPTATION: 22,
  PREDICTION: 24,
  PREDICTION_SCENE: 25,
};

export const TOTAL_NUMBERED_SEQUENCES = 25;
