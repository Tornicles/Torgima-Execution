// Torgima execution conditions — the 7 canonical condition codes that gate
// what the user is allowed to do. The DB `condition` enum mirrors these values.
//
// Spec: Prompt 1 §constants/conditions, DOC_07 Condition Codes.

export const CONDITIONS = {
  NOTHINGNESS:  "nothingness",
  DANGER:       "danger",
  URGENCY:      "urgency",
  STABILITY:    "stability",
  POWER:        "power",
  AFFLUENCE:    "affluence",
  POWER_CHANGE: "power_change",
} as const;

export type Condition = (typeof CONDITIONS)[keyof typeof CONDITIONS];

export const ALL_CONDITIONS: readonly Condition[] = [
  CONDITIONS.NOTHINGNESS,
  CONDITIONS.DANGER,
  CONDITIONS.URGENCY,
  CONDITIONS.STABILITY,
  CONDITIONS.POWER,
  CONDITIONS.AFFLUENCE,
  CONDITIONS.POWER_CHANGE,
];

export interface ConditionRule {
  label: string;
  maxDailyTasks: number;
  difficultyCap: "very_easy" | "easy" | "moderate" | "hard";
  allowedTypes: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

// Per-condition execution rules used by the Control chain when a real
// EnforcementPackageGenerator is not yet active. The full generator lands in
// Prompt 7; these defaults keep the system deterministic in the meantime.
export const CONDITION_RULES: Record<Condition, ConditionRule> = {
  nothingness: {
    label: "Nothingness — system bootstrapping; minimum viable execution.",
    maxDailyTasks: 3,
    difficultyCap: "very_easy",
    allowedTypes: ["execution", "academy"],
    riskLevel: "low",
  },
  danger: {
    label: "Danger — recovery only. No new scope. No phase advance.",
    maxDailyTasks: 3,
    difficultyCap: "very_easy",
    allowedTypes: ["recovery", "review"],
    riskLevel: "critical",
  },
  urgency: {
    label: "Urgency — stabilization focus; restricted scope expansion.",
    maxDailyTasks: 6,
    difficultyCap: "easy",
    allowedTypes: ["execution", "recovery"],
    riskLevel: "high",
  },
  stability: {
    label: "Stability — normal execution capacity (9 daily tasks).",
    maxDailyTasks: 9,
    difficultyCap: "moderate",
    allowedTypes: ["execution", "phase_checkpoint", "habit", "review"],
    riskLevel: "medium",
  },
  power: {
    label: "Power — accelerated execution authorised (12 daily tasks).",
    maxDailyTasks: 12,
    difficultyCap: "hard",
    allowedTypes: ["execution", "phase_checkpoint"],
    riskLevel: "low",
  },
  affluence: {
    label: "Affluence — peak signal; capacity to take strategic actions.",
    maxDailyTasks: 12,
    difficultyCap: "hard",
    allowedTypes: ["execution", "phase_checkpoint"],
    riskLevel: "low",
  },
  power_change: {
    label: "Power Change — controlled capacity shift; moderated load.",
    maxDailyTasks: 6,
    difficultyCap: "moderate",
    allowedTypes: ["execution", "recovery"],
    riskLevel: "medium",
  },
};
