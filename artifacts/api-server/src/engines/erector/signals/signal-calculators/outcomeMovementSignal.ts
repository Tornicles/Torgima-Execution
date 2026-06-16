import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateOutcomeMovementSignal(data: {
  highEvidenceCount: number;
  expectedEvidenceCount: number;
  evidenceIds: string[];
}): SignalResult {
  const value = clampSignal(
    (data.highEvidenceCount / Math.max(1, data.expectedEvidenceCount)) * 100,
  );
  return {
    signal_type: "OUTCOME_MOVEMENT_SIGNAL",
    value,
    confidence: confidenceFromCoverage(
      data.highEvidenceCount / Math.max(1, data.expectedEvidenceCount),
    ),
    source_evidence_ids: data.evidenceIds,
    source_execution_data: {
      high_evidence_count: data.highEvidenceCount,
      expected_evidence_count: data.expectedEvidenceCount,
    },
    calculation_method: "count(HIGH evidence) / expected_evidence_count * 100",
  };
}
