import type { GlobalSignal } from "@workspace/db/types/bhudhi";
import type { SignalMetrics } from "./types.js";

export function calculateGlobalSignal(metrics: SignalMetrics): GlobalSignal {
  const { completionRate, momentum, trend } = metrics;

  if (completionRate === 0) return "nothingness";
  if (trend === "declining" && completionRate < 0.3) return "danger";
  if (trend === "declining" && completionRate >= 0.3) return "urgency";
  if (trend === "improving" && momentum > 0.8) return "affluence";
  if (trend === "improving" && momentum > 0.5) return "power";
  if (momentum > 0.5 && completionRate > 0.7) return "powerchange";
  if (trend === "stable" && completionRate > 0.5) return "stability";

  return "stability";
}

export function getConfidence(signal: GlobalSignal, metrics: SignalMetrics): number {
  const base = Math.min(metrics.confidence * 0.8 + 0.2, 1);
  const signalBoost: Record<GlobalSignal, number> = {
    nothingness: 0.9,
    danger: 0.85,
    urgency: 0.75,
    stability: 0.7,
    power: 0.8,
    affluence: 0.85,
    powerchange: 0.78,
  };
  return Math.min(1, Math.round((base * 0.7 + (signalBoost[signal] ?? 0.7) * 0.3) * 100) / 100);
}

export function getSignalInterpretation(signal: GlobalSignal): string {
  const interpretations: Record<GlobalSignal, string> = {
    nothingness: "No execution yet. Start first task.",
    danger: "System is failing. Intervention needed immediately.",
    urgency: "Instability detected. Act now to prevent failure.",
    stability: "Controlled execution. On track.",
    power: "Strong performance. System accelerating.",
    affluence: "Excellent results. High output and compounding.",
    powerchange: "Major transition happening. Monitor closely.",
  };
  return interpretations[signal];
}

export function toBhudhiSignalMetrics(metrics: SignalMetrics): SignalMetrics {
  return {
    completionRate: metrics.completionRate,
    momentum: metrics.momentum,
    trend: metrics.trend,
    confidenceLevel: metrics.confidence,
  };
}
