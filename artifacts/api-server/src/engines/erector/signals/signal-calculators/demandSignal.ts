import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateDemandSignal(data: {
  validationDemandScore: number | null;
  evidenceDerivedScore: number;
  evidenceIds: string[];
}): SignalResult {
  const validation = data.validationDemandScore ?? 0;
  const value = clampSignal(Math.max(validation, data.evidenceDerivedScore));
  return {
    signal_type: "DEMAND_SIGNAL",
    value,
    confidence: confidenceFromCoverage(value / 100),
    source_evidence_ids: data.evidenceIds,
    source_execution_data: {
      validation_demand_score: validation,
      evidence_derived_score: data.evidenceDerivedScore,
    },
    calculation_method: "max(validation_demand_proof_score, evidence_derived_demand_score)",
  };
}
