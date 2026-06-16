import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateMarketSignal(data: {
  marketScore: number | null;
  weeksSinceNewEvidence: number;
  evidenceIds: string[];
}): SignalResult {
  const base = data.marketScore ?? 0;
  const recencyWeight = Math.max(0, 1 - data.weeksSinceNewEvidence * 0.02);
  const value = clampSignal(base * recencyWeight);
  return {
    signal_type: "MARKET_SIGNAL",
    value,
    confidence: confidenceFromCoverage(recencyWeight),
    source_evidence_ids: data.evidenceIds,
    source_execution_data: {
      market_score: base,
      weeks_since_new_evidence: data.weeksSinceNewEvidence,
      recency_weight: recencyWeight,
    },
    calculation_method: "market_score * recency_weight (decays 2% per week)",
  };
}
