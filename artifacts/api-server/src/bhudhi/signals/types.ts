import type {
  BhudhiFrameworkSignalEntry,
  BhudhiSignal,
  BhudhiSignalMetrics,
  GlobalSignal,
} from "@workspace/db/types/bhudhi";

export type { GlobalSignal, BhudhiSignal, BhudhiSignalMetrics, BhudhiFrameworkSignalEntry };

export interface SignalMetrics extends BhudhiSignalMetrics {
  confidence?: number;
  clarity?: number;
  demandTrend?: number;
  satisfactionScore?: number;
  throughput?: number;
  targetThroughput?: number;
  burnRate?: number;
  revenue?: number;
  runway?: number;
  capabilityScore?: number;
  morale?: number;
  confusionLevel?: number;
  riskScore?: number;
  learningVelocity?: number;
  decisionSpeed?: number;
  adaptabilityScore?: number;
  renewalCapacity?: number;
  weightedScore?: number;
  feedbackRate?: number;
  gamingRate?: number;
}

export interface FrameworkSignalResult {
  signal: GlobalSignal;
  confidence: number;
  reasoning: string;
}

export type FrameworkSignalsMap = Record<string, FrameworkSignalResult>;
