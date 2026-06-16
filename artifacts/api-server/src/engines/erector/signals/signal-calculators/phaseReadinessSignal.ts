import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculatePhaseReadinessSignal(data: {
  readinessScore: number | null;
  phaseGateId?: string | null;
}): SignalResult {
  const value = clampSignal(data.readinessScore ?? 0);
  return {
    signal_type: "PHASE_READINESS_SIGNAL",
    value,
    confidence: confidenceFromCoverage(value / 100),
    source_evidence_ids: [],
    source_execution_data: {
      readiness_score: data.readinessScore,
      phase_gate_id: data.phaseGateId ?? null,
    },
    calculation_method: "latest erector_phase_gates.readiness_score",
  };
}
