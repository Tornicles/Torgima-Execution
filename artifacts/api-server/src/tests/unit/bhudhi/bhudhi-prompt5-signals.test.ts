import { describe, it, expect } from "vitest";
import { BHUDHI_FRAMEWORKS } from "@workspace/db/bhudhi-seed-data";
import {
  calculateGlobalSignal,
  getConfidence,
  getSignalInterpretation,
} from "../../../bhudhi/signals/signalCalculation.js";
import {
  calculateFrameworkSignal,
  listFrameworkSignalKeys,
} from "../../../bhudhi/signals/frameworkSignalLogic.js";
import type { SignalMetrics } from "../../../bhudhi/signals/types.js";
import type { GlobalSignal } from "@workspace/db/types/bhudhi";

const GLOBAL_SIGNALS: GlobalSignal[] = [
  "nothingness",
  "danger",
  "urgency",
  "stability",
  "power",
  "affluence",
  "powerchange",
];

function baseMetrics(overrides: Partial<SignalMetrics> = {}): SignalMetrics {
  return {
    completionRate: 0.6,
    momentum: 0.2,
    trend: "stable",
    confidenceLevel: 0.8,
    confidence: 0.8,
    clarity: 0.75,
    demandTrend: 0.1,
    satisfactionScore: 0.8,
    throughput: 12,
    targetThroughput: 15,
    burnRate: 1000,
    revenue: 12000,
    runway: 12,
    capabilityScore: 0.7,
    morale: 0.7,
    confusionLevel: 0.2,
    riskScore: 0.3,
    learningVelocity: 0.6,
    decisionSpeed: 0.75,
    adaptabilityScore: 0.65,
    renewalCapacity: 0.6,
    ...overrides,
  };
}

describe("BHUDHI PROMPT 5 — Signal System", () => {
  it("implements all 7 global signals", () => {
    expect(calculateGlobalSignal(baseMetrics({ completionRate: 0 }))).toBe("nothingness");
    expect(
      calculateGlobalSignal(baseMetrics({ trend: "declining", completionRate: 0.2, momentum: -0.2 })),
    ).toBe("danger");
    expect(
      calculateGlobalSignal(baseMetrics({ trend: "declining", completionRate: 0.5, momentum: -0.15 })),
    ).toBe("urgency");
    expect(
      calculateGlobalSignal(baseMetrics({ trend: "stable", completionRate: 0.6 })),
    ).toBe("stability");
    expect(
      calculateGlobalSignal(baseMetrics({ trend: "improving", momentum: 0.6, completionRate: 0.5 })),
    ).toBe("power");
    expect(
      calculateGlobalSignal(baseMetrics({ trend: "improving", momentum: 0.85, completionRate: 0.5 })),
    ).toBe("affluence");
    expect(
      calculateGlobalSignal(baseMetrics({ momentum: 0.6, completionRate: 0.75, trend: "stable" })),
    ).toBe("powerchange");
  });

  it("provides interpretation for every global signal", () => {
    for (const signal of GLOBAL_SIGNALS) {
      const text = getSignalInterpretation(signal);
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it("computes confidence bounded 0-1", () => {
    const c = getConfidence("power", baseMetrics());
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("defines framework signal logic for 14 team frameworks", () => {
    const team = BHUDHI_FRAMEWORKS.filter((f) => f.type === "team");
    expect(team).toHaveLength(14);
    const keys = listFrameworkSignalKeys();
    for (const fw of team) {
      expect(keys).toContain(fw.name);
      const result = calculateFrameworkSignal("bp-1", fw.name, baseMetrics());
      expect(GLOBAL_SIGNALS).toContain(result.signal);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning.length).toBeGreaterThan(0);
    }
  });

  it("includes individual mastery framework signal", () => {
    const result = calculateFrameworkSignal("bp-1", "INDIVIDUAL_MASTERY", baseMetrics());
    expect(result.signal).toBeTruthy();
  });

  it("STRATEGYCORE and GOVERNANCE_RISK respond to metrics", () => {
    const clear = calculateFrameworkSignal("bp-1", "STRATEGYCORE", baseMetrics({ clarity: 0.9 }));
    expect(clear.signal).toBe("stability");
    const risky = calculateFrameworkSignal("bp-1", "GOVERNANCE_RISK", baseMetrics({ riskScore: 0.8 }));
    expect(risky.signal).toBe("danger");
  });
});
