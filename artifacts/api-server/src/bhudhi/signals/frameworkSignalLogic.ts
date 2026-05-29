/**
 * Framework-specific signal logic (14 team + individual).
 */
import type { GlobalSignal } from "@workspace/db/types/bhudhi";
import type { FrameworkSignalResult, SignalMetrics } from "./types.js";

type FrameworkSignalFn = (_blueprintId: string, metrics: SignalMetrics) => FrameworkSignalResult;

function num(value: number | undefined, fallback = 0): number {
  return value ?? fallback;
}

function result(
  signal: GlobalSignal,
  confidence: number,
  reasoning: string,
): FrameworkSignalResult {
  return {
    signal,
    confidence: Math.min(1, Math.max(0, Math.round(confidence * 100) / 100)),
    reasoning,
  };
}

const LOGIC: Record<string, FrameworkSignalFn> = {
  STRATEGYCORE: (_bp, m) =>
    result(
      num(num(m.clarity)) > 0.7 ? "stability" : "urgency",
      num(num(m.clarity)),
      `Strategy clarity: ${(num(num(m.clarity)) * 100).toFixed(0)}%`,
    ),

  OMNIGROWTH: (_bp, m) =>
    result(
      num(m.demandTrend) > 0 ? "power" : "danger",
      Math.abs(num(m.demandTrend)),
      `Demand trend: ${num(m.demandTrend) > 0 ? "positive" : "negative"}`,
    ),

  CUSTOMERVALUE: (_bp, m) =>
    result(
      num(m.satisfactionScore) > 0.7 ? "affluence" : "urgency",
      num(m.satisfactionScore),
      `Customer satisfaction: ${(num(m.satisfactionScore) * 100).toFixed(0)}%`,
    ),

  SYNERGYOPS: (_bp, m) =>
    result(
      num(m.throughput) > num(m.targetThroughput) * 0.8 ? "power" : "urgency",
      Math.min(1, num(m.throughput) / (num(m.targetThroughput) * 1.2)),
      `Throughput: ${num(m.throughput)} tasks/day`,
    ),

  FINMATRIX: (_bp, m) => {
    const healthy = num(m.revenue) > 0 && num(m.burnRate) < num(m.revenue) / 12;
    return result(
      healthy ? "affluence" : "danger",
      num(m.revenue) > 0 ? 1 - Math.min(num(m.burnRate) / num(m.revenue), 1) : 0.5,
      `Financial health: Runway ${num(m.runway)} months`,
    );
  },

  TALENTSYNC: (_bp, m) =>
    result(
      num(m.capabilityScore) > 0.7 ? "power" : "urgency",
      num(m.capabilityScore),
      `Team capability: ${(num(m.capabilityScore) * 100).toFixed(0)}%`,
    ),

  CULTURE_DYNAMICS: (_bp, m) =>
    result(
      num(m.morale) > 0.6 ? "stability" : "danger",
      Math.abs(num(m.morale) - 0.5) + 0.5,
      `Team morale: ${num(m.morale) > 0.5 ? "positive" : "negative"}`,
    ),

  ALIGNMENT_ACCOUNTABILITY: (_bp, m) =>
    result(
      num(m.clarity) > 0.75 ? "stability" : "urgency",
      num(m.clarity),
      `Alignment clarity: ${(num(m.clarity) * 100).toFixed(0)}%`,
    ),

  CLARITY_CATALYST: (_bp, m) =>
    result(
      num(m.confusionLevel) < 0.3 ? "stability" : "urgency",
      1 - num(m.confusionLevel),
      `Confusion level: ${(num(m.confusionLevel) * 100).toFixed(0)}%`,
    ),

  GOVERNANCE_RISK: (_bp, m) =>
    result(
      num(m.riskScore) < 0.4 ? "stability" : "danger",
      1 - num(m.riskScore),
      `Risk level: ${(num(m.riskScore) * 100).toFixed(0)}%`,
    ),

  KNOWLEDGEFLOW: (_bp, m) =>
    result(
      num(m.learningVelocity) > 0.5 ? "power" : "stability",
      num(m.learningVelocity),
      `Learning velocity: ${(num(m.learningVelocity) * 100).toFixed(0)}%`,
    ),

  DECISION_VELOCITY: (_bp, m) =>
    result(
      num(m.decisionSpeed) > 0.7 ? "power" : "urgency",
      num(m.decisionSpeed),
      `Decision speed: ${(num(m.decisionSpeed) * 100).toFixed(0)}%`,
    ),

  ADAPTIVE_INTELLIGENCE: (_bp, m) =>
    result(
      num(m.adaptabilityScore) > 0.6 ? "power" : "urgency",
      num(m.adaptabilityScore),
      `Adaptability: ${(num(m.adaptabilityScore) * 100).toFixed(0)}%`,
    ),

  REGENERATION_EXIT: (_bp, m) =>
    result(
      num(m.renewalCapacity) > 0.5 ? "stability" : "danger",
      num(m.renewalCapacity),
      `Renewal capacity: ${(num(m.renewalCapacity) * 100).toFixed(0)}%`,
    ),

  INDIVIDUAL_MASTERY: (_bp, m) =>
    result(
      m.completionRate > 0.6 ? "power" : m.completionRate > 0.3 ? "stability" : "nothingness",
      m.completionRate,
      `Individual execution rate: ${(m.completionRate * 100).toFixed(0)}%`,
    ),
};

export function calculateFrameworkSignal(
  blueprintId: string,
  frameworkName: string,
  metrics: SignalMetrics,
): FrameworkSignalResult {
  const fn = LOGIC[frameworkName];
  if (fn) return fn(blueprintId, metrics);
  return result("stability", 0.5, "Default framework signal");
}

export function listFrameworkSignalKeys(): string[] {
  return Object.keys(LOGIC);
}
