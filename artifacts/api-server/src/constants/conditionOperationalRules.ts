/**
 * CONDITION_SYSTEM_SPECIFICATION — operational rules per condition.
 * Restricted/allowed actions feed ControlEngine and dashboard display.
 */
import { CONDITIONS, type Condition } from "./conditions.js";

export interface ConditionOperationalRule {
  restrictedActions: string[];
  allowedActions: string[];
  recoveryTaskTypes: string[];
  transitionMessage: string;
}

export const CONDITION_OPERATIONAL_RULES: Record<
  "danger" | "urgency" | "stability" | "power",
  ConditionOperationalRule
> = {
  danger: {
    restrictedActions: [
      "phase_advance",
      "new_scope",
      "growth_tasks",
      "scale_tasks",
      "difficult_tasks",
    ],
    allowedActions: ["recovery", "clarification", "simplification", "blocker_resolution"],
    recoveryTaskTypes: ["clarification", "simplification", "blocker_resolution", "check_in"],
    transitionMessage:
      "System in recovery mode. Focus on restoring production and operations before expanding scope.",
  },
  urgency: {
    restrictedActions: ["phase_advance", "growth_tasks", "scale_tasks"],
    allowedActions: ["execution", "recovery", "blocker_resolution"],
    recoveryTaskTypes: ["blocker_resolution", "check_in"],
    transitionMessage:
      "Stabilization mode. Clear blockers and restore momentum before growth work.",
  },
  stability: {
    restrictedActions: [],
    allowedActions: ["execution", "phase_checkpoint", "habit", "review"],
    recoveryTaskTypes: [],
    transitionMessage: "Normal execution. Balanced Foundation, Operations, and Growth.",
  },
  power: {
    restrictedActions: [],
    allowedActions: ["execution", "phase_checkpoint", "growth_tasks", "scale_tasks"],
    recoveryTaskTypes: [],
    transitionMessage: "Accelerated execution. Growth and scale tasks enabled.",
  },
};

export const DANGER_RECOVERY_TASK_ROTATION = [
  "clarification",
  "simplification",
  "blocker_resolution",
  "check_in",
] as const;

export function getOperationalRulesForCondition(
  condition: string,
): ConditionOperationalRule | null {
  const key = condition as keyof typeof CONDITION_OPERATIONAL_RULES;
  if (key in CONDITION_OPERATIONAL_RULES) {
    return CONDITION_OPERATIONAL_RULES[key];
  }
  if (condition === CONDITIONS.NOTHINGNESS) {
    return {
      restrictedActions: ["phase_advance", "growth_tasks", "scale_tasks"],
      allowedActions: ["execution", "academy"],
      recoveryTaskTypes: [],
      transitionMessage: "Bootstrap mode — minimum viable execution only.",
    };
  }
  return null;
}
