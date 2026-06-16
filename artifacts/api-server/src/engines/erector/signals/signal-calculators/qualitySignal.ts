import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export interface QualitySignalData {
  feedbackScores: number[];
  skipCount: number;
  totalCount: number;
  avgConfidenceWeight: number;
}

export function calculateQualitySignal(data: QualitySignalData): SignalResult {
  const scored = data.feedbackScores.filter((s) => Number.isFinite(s));
  const avgScore =
    scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  const skipRatio = data.totalCount > 0 ? data.skipCount / data.totalCount : 0;
  const confidenceWeight = data.avgConfidenceWeight > 0 ? data.avgConfidenceWeight : 1;
  const value = clampSignal((avgScore / 10) * (1 - skipRatio) * confidenceWeight * 100);

  return {
    signal_type: "QUALITY_SIGNAL",
    value,
    confidence: confidenceFromCoverage(scored.length / Math.max(1, data.totalCount)),
    source_evidence_ids: [],
    source_execution_data: {
      avg_score: avgScore,
      skip_ratio: skipRatio,
      feedback_count: scored.length,
    },
    calculation_method: "weighted_avg(score/10) * (1 - skip_ratio) * confidence_weight * 100",
  };
}
