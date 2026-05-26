/**
 * CONDITION_SYSTEM_SPECIFICATION.md — Production / Operations / Growth / Scale → 4 core conditions.
 */
import type { OperationalMathematicsDocument } from "../signal/SignalOperationalMathematicsEngine.js";
import type { SignalMetrics } from "../signal/SignalCalculationEngine.types.js";
import { CONDITIONS, type Condition } from "../../constants/conditions.js";
import { dailyTasksForCondition, DAILY_TASKS_BY_CONDITION } from "../../constants/conditionSpec.js";
import {
  getOperationalRulesForCondition,
  DANGER_RECOVERY_TASK_ROTATION,
} from "../../constants/conditionOperationalRules.js";
import { getAllocationForCondition, type MiniPlanAllocation } from "../mini-plan/MiniPlanAllocationEngine.js";

export { dailyTasksForCondition, DAILY_TASKS_BY_CONDITION };

export const FRAMEWORK_SIGNAL_KEYS = ["Production", "Operations", "Growth", "Scale"] as const;

export interface FrameworkSignalsInput {
  production: number;
  operations: number;
  growth: number;
  scale: number;
  /** Normalized delta, typically −1..1 (structured feedback) or momentum/14. */
  momentum?: number;
}

export type CoreFourCondition =
  | typeof CONDITIONS.DANGER
  | typeof CONDITIONS.URGENCY
  | typeof CONDITIONS.STABILITY
  | typeof CONDITIONS.POWER;

export interface ConditionDisplaySpec {
  condition: string;
  label: string;
  emoji: string;
  colorKey: "danger" | "urgency" | "stability" | "power" | "neutral";
  summary: string;
  dailyTasksAllowed: number;
  canProgress: boolean;
  canScale: boolean;
  recoveryRequired: boolean;
  taskFocus: string;
  miniPlanAllocation: MiniPlanAllocation;
  restrictedActions: string[];
  allowedActions: string[];
  recoveryTaskTypes: string[];
  transitionMessage: string;
}

const DISPLAY: Record<
  string,
  Omit<
    ConditionDisplaySpec,
    "condition" | "miniPlanAllocation" | "restrictedActions" | "allowedActions" | "recoveryTaskTypes" | "transitionMessage"
  >
> = {
  danger: {
    label: "Danger",
    emoji: "🔴",
    colorKey: "danger",
    summary: "Execution needs recovery — focus on blockers and simplification.",
    dailyTasksAllowed: 3,
    canProgress: false,
    canScale: false,
    recoveryRequired: true,
    taskFocus: "recovery",
  },
  urgency: {
    label: "Urgency",
    emoji: "🟡",
    colorKey: "urgency",
    summary: "Execution is at risk — stabilize operations before expanding.",
    dailyTasksAllowed: 6,
    canProgress: true,
    canScale: false,
    recoveryRequired: false,
    taskFocus: "stabilization",
  },
  stability: {
    label: "Stability",
    emoji: "🟢",
    colorKey: "stability",
    summary: "Execution is balanced — continue normal daily work.",
    dailyTasksAllowed: 9,
    canProgress: true,
    canScale: true,
    recoveryRequired: false,
    taskFocus: "normal_execution",
  },
  power: {
    label: "Power",
    emoji: "🔵",
    colorKey: "power",
    summary: "Execution exceeds expectations — acceleration is available.",
    dailyTasksAllowed: 12,
    canProgress: true,
    canScale: true,
    recoveryRequired: false,
    taskFocus: "acceleration",
  },
  nothingness: {
    label: "Nothingness",
    emoji: "⚪",
    colorKey: "neutral",
    summary: "Collecting signal data — minimum execution until feedback stabilizes.",
    dailyTasksAllowed: 3,
    canProgress: false,
    canScale: false,
    recoveryRequired: false,
    taskFocus: "bootstrap",
  },
  affluence: {
    label: "Affluence",
    emoji: "🟣",
    colorKey: "power",
    summary: "Peak execution — strategic expansion enabled.",
    dailyTasksAllowed: 12,
    canProgress: true,
    canScale: true,
    recoveryRequired: false,
    taskFocus: "acceleration",
  },
  power_change: {
    label: "Power Change",
    emoji: "🟠",
    colorKey: "urgency",
    summary: "Rapid condition shift — moderated load while signals stabilize.",
    dailyTasksAllowed: 6,
    canProgress: true,
    canScale: false,
    recoveryRequired: false,
    taskFocus: "stabilization",
  },
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function normalizeFrameworkSignals(raw: Record<string, number>): FrameworkSignalsInput {
  return {
    production: clamp01(raw.Production ?? raw.production ?? 0.5),
    operations: clamp01(raw.Operations ?? raw.operations ?? 0.5),
    growth: clamp01(raw.Growth ?? raw.growth ?? 0.5),
    scale: clamp01(raw.Scale ?? raw.scale ?? 0.5),
    momentum: raw.momentum ?? raw.Momentum,
  };
}

/**
 * Spec algorithm: DANGER → POWER → URGENCY → STABILITY (default).
 */
export function determineConditionFromFrameworkSignals(
  input: FrameworkSignalsInput,
): CoreFourCondition {
  const production = clamp01(input.production);
  const operations = clamp01(input.operations);
  const growth = clamp01(input.growth);
  const scale = clamp01(input.scale);
  const momentum = input.momentum ?? 0;

  if (production < 0.4 || operations < 0.3 || momentum < -0.15) {
    return CONDITIONS.DANGER;
  }
  if (production < 0.5 && operations < 0.5) {
    return CONDITIONS.DANGER;
  }

  if (growth >= 0.8 && momentum > 0.1) {
    return CONDITIONS.POWER;
  }
  if (production >= 0.85 && operations >= 0.75) {
    return CONDITIONS.POWER;
  }
  if (scale >= 0.85 && growth >= 0.75) {
    return CONDITIONS.POWER;
  }

  if (
    (production < 0.7 && operations < 0.7) ||
    growth < 0.5 ||
    scale < 0.5 ||
    (momentum < 0 && production < 0.75)
  ) {
    return CONDITIONS.URGENCY;
  }

  if (production >= 0.7 && operations >= 0.6 && growth >= 0.5 && scale >= 0.7) {
    return CONDITIONS.STABILITY;
  }

  // Partially healthy — not crisis, not full stability.
  if (production < 0.7 || operations < 0.6) {
    return CONDITIONS.URGENCY;
  }

  return CONDITIONS.STABILITY;
}

/** Spec exit criteria — prevents leaving DANGER/URGENCY before recovery thresholds. */
export function applyConditionExitHysteresis(
  previousCondition: string,
  proposed: CoreFourCondition,
  signals: FrameworkSignalsInput,
  options?: { blockerCount?: number },
): CoreFourCondition {
  const prev = previousCondition.toLowerCase().replace(/\s+/g, "_");
  const blockers = options?.blockerCount ?? 0;
  const momentum = signals.momentum ?? 0;

  if (prev === CONDITIONS.DANGER && proposed !== CONDITIONS.DANGER) {
    const canExitDanger =
      signals.production >= 0.5 && signals.operations >= 0.4 && momentum > 0;
    if (!canExitDanger) return CONDITIONS.DANGER;
    if (proposed === CONDITIONS.STABILITY || proposed === CONDITIONS.POWER) {
      return CONDITIONS.URGENCY;
    }
  }

  if (
    prev === CONDITIONS.URGENCY &&
    (proposed === CONDITIONS.STABILITY || proposed === CONDITIONS.POWER)
  ) {
    const canExitUrgency =
      signals.production >= 0.7 &&
      signals.operations >= 0.7 &&
      momentum > 0 &&
      blockers < 2;
    if (!canExitUrgency && proposed === CONDITIONS.STABILITY) {
      return CONDITIONS.URGENCY;
    }
  }

  return proposed;
}

export function estimateBlockerCountFromMetrics(metrics: SignalMetrics): number {
  if (metrics.blocker_ratio >= 0.5) return 3;
  if (metrics.blocker_ratio >= 0.3) return 2;
  if (metrics.blocker_ratio >= 0.15) return 1;
  return 0;
}

export { DANGER_RECOVERY_TASK_ROTATION };

export function metricsToFrameworkSignals(
  metrics: SignalMetrics,
  operationalMathematics?: OperationalMathematicsDocument | null,
  structured?: {
    production_signal?: number;
    operations_signal?: number;
    growth_signal?: number;
    scale_signal?: number;
    momentum?: number;
  } | null,
): FrameworkSignalsInput {
  if (structured?.production_signal != null) {
    return {
      production: clamp01(structured.production_signal),
      operations: clamp01(structured.operations_signal ?? metrics.weighted_score / 10),
      growth: clamp01(structured.growth_signal ?? 0.5),
      scale: clamp01(structured.scale_signal ?? 0.5),
      momentum:
        structured.momentum ??
        (metrics.momentum !== 0 ? metrics.momentum / 14 : 0),
    };
  }

  const om = operationalMathematics?.scores;
  const production = clamp01(metrics.completion_rate);
  const operations = clamp01(metrics.weighted_score / 10);
  const growthProxy = clamp01(production * 0.35 + operations * 0.65);
  return {
    production,
    operations,
    growth: clamp01(om?.momentum_score.normalized ?? growthProxy),
    scale: clamp01(om?.execution_consistency.normalized ?? 1 - metrics.blocker_ratio),
    momentum: metrics.momentum / 14,
  };
}

export function assignConditionFromMetrics(
  metrics: SignalMetrics,
  previousCondition: string,
  options?: {
    operationalMathematics?: OperationalMathematicsDocument | null;
    structuredSignals?: {
      production_signal?: number;
      operations_signal?: number;
      growth_signal?: number;
      scale_signal?: number;
      momentum?: number;
    } | null;
  },
): Condition {
  if (
    metrics.confidence === "insufficient_data" ||
    metrics.tasks_in_window < 3 ||
    (metrics.completion_rate < 0.1 && metrics.weighted_score < 2)
  ) {
    return CONDITIONS.NOTHINGNESS;
  }

  const framework = metricsToFrameworkSignals(
    metrics,
    options?.operationalMathematics,
    options?.structuredSignals,
  );
  let core = determineConditionFromFrameworkSignals(framework);
  core = applyConditionExitHysteresis(previousCondition, core, framework, {
    blockerCount: estimateBlockerCountFromMetrics(metrics),
  });

  if (
    core === CONDITIONS.POWER &&
    framework.production >= 0.9 &&
    framework.operations >= 0.85 &&
    framework.growth >= 0.82 &&
    framework.scale >= 0.88
  ) {
    return CONDITIONS.AFFLUENCE;
  }

  return core;
}

export function getConditionDisplaySpec(condition: string): ConditionDisplaySpec {
  const key = condition.toLowerCase().replace(/\s+/g, "_");
  const base = DISPLAY[key] ?? DISPLAY.stability;
  const ops = getOperationalRulesForCondition(key);
  return {
    condition: key,
    ...base,
    miniPlanAllocation: getAllocationForCondition(key),
    restrictedActions: ops?.restrictedActions ?? [],
    allowedActions: ops?.allowedActions ?? [],
    recoveryTaskTypes: ops?.recoveryTaskTypes ?? [],
    transitionMessage: ops?.transitionMessage ?? base.summary,
  };
}

export function frameworkSignalsRecord(input: FrameworkSignalsInput): Record<string, number> {
  return {
    Production: input.production,
    Operations: input.operations,
    Growth: input.growth,
    Scale: input.scale,
    momentum: input.momentum ?? 0,
  };
}
