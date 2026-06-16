export const ERECTOR_SIGNAL_TYPES = [
  "QUALITY_SIGNAL",
  "CONSISTENCY_SIGNAL",
  "COMPLETION_SIGNAL",
  "OUTCOME_MOVEMENT_SIGNAL",
  "CAPABILITY_SIGNAL",
  "DEMAND_SIGNAL",
  "MARKET_SIGNAL",
  "FEASIBILITY_SIGNAL",
  "CONTRADICTION_SIGNAL",
  "RETENTION_SIGNAL",
  "ECONOMIC_SIGNAL",
  "FALSE_PROGRESS_SIGNAL",
  "PHASE_READINESS_SIGNAL",
] as const;

export type ErectorSignalType = (typeof ERECTOR_SIGNAL_TYPES)[number];

export interface SignalCalculationInput {
  userId: string;
  blueprintId: string;
  validationRunId?: string;
  windowDays?: number;
  archetype?: string | null;
}

export interface SignalResult {
  signal_type: ErectorSignalType;
  value: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  source_evidence_ids: string[];
  source_execution_data: Record<string, unknown>;
  calculation_method: string;
}

export function clampSignal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function confidenceFromCoverage(ratio: number): SignalResult["confidence"] {
  if (ratio >= 0.75) return "HIGH";
  if (ratio >= 0.4) return "MEDIUM";
  return "LOW";
}
