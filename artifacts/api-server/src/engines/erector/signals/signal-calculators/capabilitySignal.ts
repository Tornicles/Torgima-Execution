import { clampSignal, confidenceFromCoverage, type SignalResult } from "../types.js";

export function calculateCapabilitySignal(data: {
  capabilitySignals: number[];
}): SignalResult {
  const signals = data.capabilitySignals.filter((s) => Number.isFinite(s));
  const avg =
    signals.length > 0 ? signals.reduce((a, b) => a + b, 0) / signals.length : 0;
  return {
    signal_type: "CAPABILITY_SIGNAL",
    value: clampSignal(avg),
    confidence: confidenceFromCoverage(signals.length / Math.max(1, signals.length || 1)),
    source_evidence_ids: [],
    source_execution_data: { capability_count: signals.length, average: avg },
    calculation_method: "avg(capability_profiles.capability_signal)",
  };
}
