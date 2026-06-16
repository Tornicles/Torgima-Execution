import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateCompletionSignal(data: {
  completedCount: number;
  assignedCount: number;
}): SignalResult {
  const value = clampSignal((data.completedCount / Math.max(1, data.assignedCount)) * 100);
  return {
    signal_type: "COMPLETION_SIGNAL",
    value,
    confidence: confidenceFromCoverage(data.completedCount / Math.max(1, data.assignedCount)),
    source_evidence_ids: [],
    source_execution_data: {
      completed_count: data.completedCount,
      assigned_count: data.assignedCount,
    },
    calculation_method: "(completed_count / assigned_count) * 100",
  };
}
