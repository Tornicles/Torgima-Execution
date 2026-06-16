import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

const SEVERITY_WEIGHT: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function calculateFalseProgressSignal(data: {
  openFlags: Array<{ severity: string | null }>;
  expectedProgressPoints: number;
}): SignalResult {
  const weighted = data.openFlags.reduce(
    (sum, flag) => sum + (SEVERITY_WEIGHT[String(flag.severity ?? "MEDIUM").toUpperCase()] ?? 2),
    0,
  );
  const value = clampSignal((weighted / Math.max(1, data.expectedProgressPoints)) * 100);
  return {
    signal_type: "FALSE_PROGRESS_SIGNAL",
    value,
    confidence: confidenceFromCoverage(data.openFlags.length > 0 ? 0.9 : 0.2),
    source_evidence_ids: [],
    source_execution_data: {
      open_flag_count: data.openFlags.length,
      severity_weight_sum: weighted,
      expected_progress_points: data.expectedProgressPoints,
    },
    calculation_method: "(open_false_progress_flags * severity_weight) / expected_progress_points * 100",
  };
}
