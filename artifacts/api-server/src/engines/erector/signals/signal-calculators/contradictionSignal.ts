import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateContradictionSignal(data: {
  contradictedCount: number;
  totalEvidenceCount: number;
  evidenceIds: string[];
}): SignalResult {
  const value = clampSignal(
    (data.contradictedCount / Math.max(1, data.totalEvidenceCount)) * 100,
  );
  return {
    signal_type: "CONTRADICTION_SIGNAL",
    value,
    confidence: confidenceFromCoverage(data.totalEvidenceCount > 0 ? 1 : 0),
    source_evidence_ids: data.evidenceIds,
    source_execution_data: {
      contradicted_count: data.contradictedCount,
      total_evidence_count: data.totalEvidenceCount,
    },
    calculation_method: "(contradicted_evidence_count / total_evidence_count) * 100",
  };
}
