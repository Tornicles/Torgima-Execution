/**
 * DOC21 — pattern detection rules (pure, testable).
 */

import type { NormalizedBehaviorEvidence } from "./BehaviorEvidenceNormalizer.js";
import type { PatternSpecLabel } from "./PatternLearningEngine.js";

const PATTERN_MIN_OCCURRENCES = 3;

function meetsPatternThreshold(count: number): boolean {
  return count >= PATTERN_MIN_OCCURRENCES;
}

export type DetectedPattern = {
  label: PatternSpecLabel;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  windowDays: number;
  evidence: Record<string, unknown>;
};

export function detectDelayPattern(
  evidence: NormalizedBehaviorEvidence,
): DetectedPattern | null {
  if (evidence.hasOpenInactivity) return null;
  if (!meetsPatternThreshold(evidence.w7.delaySubmissionCount)) return null;
  return {
    label: "DELAY_PATTERN",
    severity: "MEDIUM",
    windowDays: 7,
    evidence: { delay_count: evidence.w7.delaySubmissionCount },
  };
}

export function detectDifficultyFailure(
  evidence: NormalizedBehaviorEvidence,
  difficultyHandling: string | null,
): DetectedPattern | null {
  if (difficultyHandling === "expert") return null;
  if (!meetsPatternThreshold(evidence.w14.difficultyFailureCount)) return null;
  return {
    label: "DIFFICULTY_FAILURE",
    severity: "MEDIUM",
    windowDays: 14,
    evidence: { failures: evidence.w14.difficultyFailureCount },
  };
}

export function detectTaskTypeAvoidance(
  evidence: NormalizedBehaviorEvidence,
): DetectedPattern | null {
  const w7 = evidence.w7;
  for (const [taskType, stats] of w7.completionByTaskType) {
    const avoidCount = stats.skipped + stats.failed;
    if (!meetsPatternThreshold(avoidCount)) continue;
    const otherTypes = [...w7.completionByTaskType.entries()].filter(([t]) => t !== taskType);
    const othersCompleting = otherTypes.some(
      ([, s]) => s.total >= 2 && s.completed / Math.max(1, s.total) >= 0.5,
    );
    if (othersCompleting) {
      return {
        label: "TASK_TYPE_AVOIDANCE",
        severity: "MEDIUM",
        windowDays: 7,
        evidence: { avoided_task_type: taskType, avoid_count: avoidCount },
      };
    }
  }
  return null;
}

export function detectConsistentExecution(
  evidence: NormalizedBehaviorEvidence,
  activeLabels: Set<string>,
): DetectedPattern | null {
  if (activeLabels.has("DIFFICULTY_FAILURE") || activeLabels.has("FATIGUE_RISK")) {
    return null;
  }
  if (
    evidence.w7.acceptedCount >= 5 &&
    evidence.w7.consistencyPct >= 70
  ) {
    return {
      label: "CONSISTENT_EXECUTION",
      severity: "LOW",
      windowDays: 30,
      evidence: {
        accepted_7d: evidence.w7.acceptedCount,
        consistency_pct: evidence.w7.consistencyPct,
      },
    };
  }
  return null;
}

export function detectFatigueRisk(
  evidence: NormalizedBehaviorEvidence,
  burnoutScore: number,
): DetectedPattern | null {
  const rows = evidence.recentFeedbackChronological.slice(-3);
  if (rows.length < 3) return null;

  const frictionRising =
    rows[1]!.friction_score! > rows[0]!.friction_score! &&
    rows[2]!.friction_score! > rows[1]!.friction_score!;
  const confidenceFalling =
    (rows[1]!.confidence_score ?? 5) < (rows[0]!.confidence_score ?? 5) &&
    (rows[2]!.confidence_score ?? 5) < (rows[1]!.confidence_score ?? 5);

  const rates = evidence.consecutive7DayCompletionRates;
  const completionNotImproving =
    rates.length < 2 || rates[rates.length - 1]! <= rates[rates.length - 2]!;

  const durationIncreasing =
    evidence.w7.avgDurationMinutes > 0 &&
    evidence.w14.avgDurationMinutes > 0 &&
    evidence.w7.avgDurationMinutes >= evidence.w14.avgDurationMinutes * 1.1;

  if (
    frictionRising &&
    confidenceFalling &&
    durationIncreasing &&
    completionNotImproving
  ) {
    const severity =
      burnoutScore >= 75 ? "CRITICAL"
      : burnoutScore >= 50 ? "HIGH"
      : burnoutScore >= 25 ? "MEDIUM"
      : "LOW";
    return {
      label: "FATIGUE_RISK",
      severity,
      windowDays: 7,
      evidence: { burnout_score: burnoutScore },
    };
  }
  return null;
}

export function detectVolatileExecution(
  evidence: NormalizedBehaviorEvidence,
): DetectedPattern | null {
  const rates = evidence.consecutive7DayCompletionRates;
  let swingCount = 0;
  for (let i = 1; i < rates.length; i++) {
    if (Math.abs(rates[i]! - rates[i - 1]!) > 0.4) swingCount++;
  }
  if (swingCount >= 2) {
    return {
      label: "VOLATILE_EXECUTION",
      severity: "MEDIUM",
      windowDays: 30,
      evidence: { swing_count: swingCount },
    };
  }
  return null;
}

export function detectAbandonmentRisk(
  evidence: NormalizedBehaviorEvidence,
  signalTrendDeclining: boolean,
): DetectedPattern | null {
  if (evidence.hasOpenInactivity) return null;
  if (!signalTrendDeclining) return null;
  if (evidence.w7.completionRate >= 0.4) return null;
  return {
    label: "ABANDONMENT_RISK",
    severity: "HIGH",
    windowDays: 7,
    evidence: { completion_rate: evidence.w7.completionRate },
  };
}

export function detectRecoverySuccess(
  evidence: NormalizedBehaviorEvidence,
): DetectedPattern | null {
  if (evidence.inactivityCount30d >= 2 && evidence.recoveryResolvedWithin3Days >= 2) {
    return {
      label: "RECOVERY_SUCCESS",
      severity: "LOW",
      windowDays: 30,
      evidence: { resolved_within_3d: evidence.recoveryResolvedWithin3Days },
    };
  }
  return null;
}

export function detectPatternsFromEvidence(
  evidence: NormalizedBehaviorEvidence,
  options?: {
    difficultyHandling?: string | null;
    signalTrendDeclining?: boolean;
    burnoutScore?: number;
    extraLabels?: PatternSpecLabel[];
  },
): DetectedPattern[] {
  const detected: DetectedPattern[] = [];
  const activeLabels = new Set<PatternSpecLabel>();

  const push = (p: DetectedPattern | null) => {
    if (p && !activeLabels.has(p.label)) {
      detected.push(p);
      activeLabels.add(p.label);
    }
  };

  push(detectDelayPattern(evidence));
  push(detectDifficultyFailure(evidence, options?.difficultyHandling ?? null));
  push(detectTaskTypeAvoidance(evidence));
  push(detectConsistentExecution(evidence, activeLabels));
  push(detectFatigueRisk(evidence, options?.burnoutScore ?? 0));
  push(detectVolatileExecution(evidence));
  push(detectAbandonmentRisk(evidence, options?.signalTrendDeclining ?? false));
  push(detectRecoverySuccess(evidence));

  for (const label of options?.extraLabels ?? []) {
    if (!activeLabels.has(label)) {
      detected.push({
        label,
        severity: "MEDIUM",
        windowDays: 14,
        evidence: { legacy_detection: true },
      });
      activeLabels.add(label);
    }
  }

  return detected;
}
