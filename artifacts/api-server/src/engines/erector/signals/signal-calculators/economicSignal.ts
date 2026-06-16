import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateEconomicSignal(data: {
  sustainabilityScore: number;
  revenueEvidenceCount: number;
  costEvidenceCount: number;
  evidenceIds: string[];
}): SignalResult {
  const evidenceBoost = Math.min(0.2, (data.revenueEvidenceCount + data.costEvidenceCount) * 0.05);
  const value = clampSignal((data.sustainabilityScore + evidenceBoost) * 100);
  return {
    signal_type: "ECONOMIC_SIGNAL",
    value,
    confidence: confidenceFromCoverage(data.revenueEvidenceCount + data.costEvidenceCount > 0 ? 0.8 : 0.3),
    source_evidence_ids: data.evidenceIds,
    source_execution_data: {
      sustainability_score: data.sustainabilityScore,
      revenue_evidence_count: data.revenueEvidenceCount,
      cost_evidence_count: data.costEvidenceCount,
    },
    calculation_method: "sustainability_score adjusted by revenue/cost evidence",
  };
}
