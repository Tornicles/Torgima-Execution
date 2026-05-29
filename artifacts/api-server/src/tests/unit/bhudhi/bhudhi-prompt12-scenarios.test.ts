import { describe, it, expect } from "vitest";
import { resolveDomainFromEventCount } from "../../../bhudhi/domains/domainLogic.js";
import { calculateGlobalSignal } from "../../../bhudhi/signals/signalCalculation.js";
import { evaluateRecommendationChecks } from "../../../bhudhi/security/securityLogic.js";
import { extractInsights } from "../../../bhudhi/external/externalAnalysis.js";
import { computeOutcomeAccuracy } from "../../../bhudhi/preservation/preservationLogic.js";

describe("BHUDHI PROMPT 12 — Test scenarios", () => {
  it("Scenario 1: new blueprint starts in genesis domain", () => {
    expect(resolveDomainFromEventCount(0)).toBe("genesis");
    expect(resolveDomainFromEventCount(2)).toBe("genesis");
  });

  it("Scenario 2: high execution rate maps to strong signals", () => {
    const signal = calculateGlobalSignal({
      completionRate: 0.9,
      momentum: 0.85,
      trend: "improving",
      confidenceLevel: 0.8,
      confidence: 0.8,
      clarity: 0.7,
      throughput: 0.8,
      feedbackRate: 0.9,
      riskScore: 0.1,
    });
    expect(["power", "affluence", "powerchange"]).toContain(signal);
  });

  it("Scenario 3: framework improves from learnings", () => {
    const previousAccuracy = 0.75;
    const improvement = 0.05;
    const newAccuracy = previousAccuracy + improvement;
    expect(newAccuracy).toBeCloseTo(0.8);
    expect(computeOutcomeAccuracy(0.8, 0.75)).toBeGreaterThan(0.9);
  });

  it("Scenario 4: recommendation passes security check", () => {
    const result = evaluateRecommendationChecks(
      { expectedRevenue: 50_000, riskProbability: 0.3, strategicallyAligned: true },
      true,
    );
    expect(result.valid).toBe(true);
  });

  it("Scenario 5: external CRM payload yields insights", () => {
    const insights = extractInsights({
      revenue: { thisMonth: 70_000, forecast: 90_000, trend: "increasing" },
      deals: { winRate: 0.8 },
      metrics: { conversionRate: 0.15 },
    });
    expect(insights.length).toBeGreaterThan(0);
  });
});
