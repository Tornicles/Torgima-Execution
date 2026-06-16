import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateFeasibilitySignal(data: {
  feasibilityScore: number | null;
  statedHoursPerWeek: number;
  actualHoursPerWeek: number;
}): SignalResult {
  const base = data.feasibilityScore ?? 0;
  const alignment =
    data.statedHoursPerWeek > 0
      ? Math.min(1, data.actualHoursPerWeek / data.statedHoursPerWeek)
      : 1;
  const value = clampSignal(base * alignment);
  return {
    signal_type: "FEASIBILITY_SIGNAL",
    value,
    confidence: confidenceFromCoverage(alignment),
    source_evidence_ids: [],
    source_execution_data: {
      feasibility_score: base,
      execution_alignment_factor: alignment,
    },
    calculation_method: "feasibility_score * execution_alignment_factor",
  };
}
