import { CONDITIONS, type Condition } from "../../constants/conditions.js";
import type { SignalMetrics } from "./SignalCalculationEngine.types.js";

/**
 * Priority-ordered condition matrix (DOC_19 / signal-chain spec).
 * When metrics conflict, earlier (more restrictive) rules win.
 */
export function assignConditionFromMetricMatrix(
  metrics: SignalMetrics,
  _previousCondition: string,
): Condition {
  const cr = metrics.completion_rate;
  const ws = metrics.weighted_score;
  const { momentum, trend, confidence, tasks_in_window: tasks } = metrics;

  if (confidence === "insufficient_data" || tasks < 3 || (cr < 0.1 && ws < 2)) {
    return CONDITIONS.NOTHINGNESS;
  }

  if (cr < 0.3 && ws < 4 && (trend === "declining" || momentum === 0)) {
    return CONDITIONS.DANGER;
  }

  if (cr >= 0.3 && cr < 0.5 && ws >= 4 && ws < 5.5) {
    return CONDITIONS.URGENCY;
  }

  if (cr >= 0.5 && cr < 0.7 && ws >= 5.5 && ws < 7 && (trend === "stable" || trend === "recovering")) {
    return CONDITIONS.STABILITY;
  }

  if (
    cr >= 0.7 &&
    cr < 0.85 &&
    ws >= 7 &&
    ws < 8.5 &&
    (trend === "stable" || trend === "rising") &&
    momentum >= 3
  ) {
    return CONDITIONS.POWER;
  }

  if (cr > 0.85 && ws > 8.5 && trend === "rising" && momentum >= 7) {
    return CONDITIONS.AFFLUENCE;
  }

  if (cr < 0.3) return CONDITIONS.DANGER;
  if (cr < 0.5) return CONDITIONS.URGENCY;
  if (cr < 0.7) return CONDITIONS.STABILITY;
  if (cr < 0.85) return CONDITIONS.POWER;
  return CONDITIONS.AFFLUENCE;
}
