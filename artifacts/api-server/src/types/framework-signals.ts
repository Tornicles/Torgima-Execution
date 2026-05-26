/** SIGNAL_SYSTEM_SPECIFICATION.md — 4 permanent execution signals. */

export const PERMANENT_SIGNAL_KEYS = ["Production", "Operations", "Growth", "Scale"] as const;
export type PermanentSignalKey = (typeof PERMANENT_SIGNAL_KEYS)[number];

export type SignalTrend = "improving" | "declining" | "stable";

export interface CalculatedFrameworkSignal {
  key: PermanentSignalKey;
  value: number;
  previousValue: number;
  momentum: number;
  change: number;
  trend: SignalTrend;
  confidence: number;
  statusLabel: string;
  metadata: Record<string, unknown>;
  valueHistory: Record<string, number>;
}

export interface FrameworkSignalsBundle {
  signals: Record<PermanentSignalKey, CalculatedFrameworkSignal>;
  feedbackCount: number;
  calculatedAt: string;
}
