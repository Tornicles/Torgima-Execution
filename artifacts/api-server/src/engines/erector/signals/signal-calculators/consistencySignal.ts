import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateConsistencySignal(data: {
  activeDays: number;
  windowDays: number;
}): SignalResult {
  const value = clampSignal((data.activeDays / Math.max(1, data.windowDays)) * 100);
  return {
    signal_type: "CONSISTENCY_SIGNAL",
    value,
    confidence: confidenceFromCoverage(data.activeDays / Math.max(1, data.windowDays)),
    source_evidence_ids: [],
    source_execution_data: { active_days: data.activeDays, window_days: data.windowDays },
    calculation_method: "(active_days / window_days) * 100",
  };
}
