/**
 * DOC21 Task 4 — resolve active patterns when behavior improves.
 */

import type { NormalizedBehaviorEvidence } from "./BehaviorEvidenceNormalizer.js";
import type { PatternSpecLabel } from "./PatternLearningEngine.js";

const DELAY_THRESHOLD_HOURS = 18;

export type ActivePatternLike = {
  id: string;
  evidence_json: unknown;
  frequency: number;
  first_detected_at: Date;
};

function specLabel(pattern: ActivePatternLike): PatternSpecLabel | "" {
  const evidence =
    pattern.evidence_json && typeof pattern.evidence_json === "object" && !Array.isArray(pattern.evidence_json)
      ? (pattern.evidence_json as Record<string, unknown>)
      : {};
  return String(evidence.spec_label ?? "") as PatternSpecLabel | "";
}

function hoursAfterTaskStart(row: {
  created_at: Date;
  orderStartedAt: Date | null;
  orderCreatedAt: Date;
  submitted_hours_after_completion: number | null;
}): number {
  if (row.submitted_hours_after_completion != null) {
    return row.submitted_hours_after_completion;
  }
  const start = row.orderStartedAt ?? row.orderCreatedAt;
  return (row.created_at.getTime() - start.getTime()) / 3600000;
}

export function shouldResolvePattern(
  pattern: ActivePatternLike,
  evidence: NormalizedBehaviorEvidence,
  ctx?: {
    outcomeMovementScore?: number;
    now?: Date;
  },
): boolean {
  const spec = specLabel(pattern);
  const rows = evidence.recentFeedbackChronological;
  const now = ctx?.now ?? new Date();

  switch (spec) {
    case "DELAY_PATTERN": {
      const tail = rows.slice(-5);
      if (tail.length < 5) return false;
      return tail.every((r) => hoursAfterTaskStart(r) <= DELAY_THRESHOLD_HOURS);
    }
    case "DIFFICULTY_FAILURE": {
      const tail = rows.slice(-3);
      if (tail.length < 3) return false;
      const difficulty = tail[0]?.taskDifficulty;
      return tail.every(
        (r) =>
          r.completion_status === "completed" &&
          (r.score ?? 0) >= 7 &&
          r.taskDifficulty === difficulty,
      );
    }
    case "TASK_TYPE_AVOIDANCE": {
      const avoidedType = (
        pattern.evidence_json as Record<string, unknown> | undefined
      )?.avoided_task_type as string | undefined;
      if (!avoidedType) return false;
      const recent = rows.filter((r) => r.taskType === avoidedType).slice(-2);
      return (
        recent.length >= 2 &&
        recent.every((r) => r.completion_status === "completed" && (r.score ?? 0) >= 7)
      );
    }
    case "LOW_VALUE_COMPLETION":
      return (ctx?.outcomeMovementScore ?? 0) > 40;
    case "ABANDONMENT_RISK": {
      const daysSinceDetection =
        (now.getTime() - pattern.first_detected_at.getTime()) / 86400000;
      return daysSinceDetection >= 7 && !evidence.hasOpenInactivity;
    }
    case "FATIGUE_RISK": {
      const tail = rows.slice(-5);
      if (tail.length < 5) return false;
      const frictionFalling = tail.every((r, i) =>
        i === 0 ? true : (r.friction_score ?? 0) <= (tail[i - 1]?.friction_score ?? 0),
      );
      const completionOk = evidence.w7.completionRate >= 0.6;
      return frictionFalling && completionOk;
    }
    case "VOLATILE_EXECUTION": {
      const rates = evidence.consecutive7DayCompletionRates;
      if (rates.length < 2) return false;
      for (let i = 1; i < rates.length; i++) {
        if (Math.abs(rates[i]! - rates[i - 1]!) > 20) return false;
      }
      return true;
    }
    case "RECOVERY_SUCCESS": {
      return evidence.recoveryResolvedWithin3Days >= 2;
    }
    default:
      return false;
  }
}

export function evaluatePatternResolutions(
  activePatterns: ActivePatternLike[],
  evidence: NormalizedBehaviorEvidence,
  ctx?: { outcomeMovementScore?: number; now?: Date },
): string[] {
  const toResolve: string[] = [];
  for (const pattern of activePatterns) {
    if (shouldResolvePattern(pattern, evidence, ctx)) {
      toResolve.push(pattern.id);
    }
  }
  return toResolve;
}
