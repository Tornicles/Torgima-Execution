/**
 * Framework-specific signal logic (14 team + individual).
 */
import type { GlobalSignal } from "@workspace/db/types/bhudhi";
import type { FrameworkSignalResult, SignalMetrics } from "./types.js";

type FrameworkSignalFn = (_blueprintId: string, metrics: SignalMetrics) => FrameworkSignalResult;

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
    result(m.clarity > 0.7 ? "stability" : "urgency", m.clarity, `Strategy clarity: ${(m.clarity * 100).toFixed(0)}%`),

  OMNIGROWTH: (_bp, m) =>
    result(
      m.demandTrend > 0 ? "power" : "danger",
      Math.abs(m.demandTrend),
      `Demand trend: ${m.demandTrend > 0 ? "positive" : "negative"}`,
    ),

  CUSTOMERVALUE: (_bp, m) =>
    result(
      m.satisfactionScore > 0.7 ? "affluence" : "urgency",
      m.satisfactionScore,
      `Customer satisfaction: ${(m.satisfactionScore * 100).toFixed(0)}%`,
    ),

  SYNERGYOPS: (_bp, m) =>
    result(
      m.throughput > m.targetThroughput * 0.8 ? "power" : "urgency",
      Math.min(1, m.throughput / (m.targetThroughput * 1.2)),
      `Throughput: ${m.throughput} tasks/day`,
    ),

  FINMATRIX: (_bp, m) => {
    const healthy = m.revenue > 0 && m.burnRate < m.revenue / 12;
    return result(
      healthy ? "affluence" : "danger",
      m.revenue > 0 ? 1 - Math.min(m.burnRate / m.revenue, 1) : 0.5,
      `Financial health: Runway ${m.runway} months`,
    );
  },

  TALENTSYNC: (_bp, m) =>
    result(
      m.capabilityScore > 0.7 ? "power" : "urgency",
      m.capabilityScore,
      `Team capability: ${(m.capabilityScore * 100).toFixed(0)}%`,
    ),

  CULTURE_DYNAMICS: (_bp, m) =>
    result(
      m.morale > 0.6 ? "stability" : "danger",
      Math.abs(m.morale - 0.5) + 0.5,
      `Team morale: ${m.morale > 0.5 ? "positive" : "negative"}`,
    ),

  ALIGNMENT_ACCOUNTABILITY: (_bp, m) =>
    result(
      m.clarity > 0.75 ? "stability" : "urgency",
      m.clarity,
      `Alignment clarity: ${(m.clarity * 100).toFixed(0)}%`,
    ),

  CLARITY_CATALYST: (_bp, m) =>
    result(
      m.confusionLevel < 0.3 ? "stability" : "urgency",
      1 - m.confusionLevel,
      `Confusion level: ${(m.confusionLevel * 100).toFixed(0)}%`,
    ),

  GOVERNANCE_RISK: (_bp, m) =>
    result(
      m.riskScore < 0.4 ? "stability" : "danger",
      1 - m.riskScore,
      `Risk level: ${(m.riskScore * 100).toFixed(0)}%`,
    ),

  KNOWLEDGEFLOW: (_bp, m) =>
    result(
      m.learningVelocity > 0.5 ? "power" : "stability",
      m.learningVelocity,
      `Learning velocity: ${(m.learningVelocity * 100).toFixed(0)}%`,
    ),

  DECISION_VELOCITY: (_bp, m) =>
    result(
      m.decisionSpeed > 0.7 ? "power" : "urgency",
      m.decisionSpeed,
      `Decision speed: ${(m.decisionSpeed * 100).toFixed(0)}%`,
    ),

  ADAPTIVE_INTELLIGENCE: (_bp, m) =>
    result(
      m.adaptabilityScore > 0.6 ? "power" : "urgency",
      m.adaptabilityScore,
      `Adaptability: ${(m.adaptabilityScore * 100).toFixed(0)}%`,
    ),

  REGENERATION_EXIT: (_bp, m) =>
    result(
      m.renewalCapacity > 0.5 ? "stability" : "danger",
      m.renewalCapacity,
      `Renewal capacity: ${(m.renewalCapacity * 100).toFixed(0)}%`,
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
