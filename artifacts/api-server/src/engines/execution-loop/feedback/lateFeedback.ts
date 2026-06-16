export type LateFeedbackResult = {
  confidence_multiplier: number;
  late_penalty_applied: boolean;
  submitted_hours_after_start: number;
  flags: string[];
};

export function applyLateFeedbackPenalty(
  confidence_multiplier: number,
  startedAt: Date | null | undefined,
  now = Date.now(),
): LateFeedbackResult {
  const hours_since_start = startedAt
    ? (now - startedAt.getTime()) / 3_600_000
    : 0;

  let multiplier = confidence_multiplier;
  const flags: string[] = [];
  let late_penalty_applied = false;

  if (hours_since_start > 168) {
    multiplier *= 0.5;
    flags.push("VERY_LATE_FEEDBACK");
    late_penalty_applied = true;
  } else if (hours_since_start > 72) {
    multiplier *= 0.7;
    late_penalty_applied = true;
  } else if (hours_since_start > 24) {
    multiplier *= 0.85;
    late_penalty_applied = true;
  }

  return {
    confidence_multiplier: Math.max(0.2, multiplier),
    late_penalty_applied,
    submitted_hours_after_start: hours_since_start,
    flags,
  };
}
