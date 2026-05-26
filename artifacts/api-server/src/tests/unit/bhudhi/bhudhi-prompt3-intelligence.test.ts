import { describe, it, expect } from "vitest";
import { BHUDHI_ENGINES, BHUDHI_FRAMEWORKS } from "@workspace/db/bhudhi-seed-data";
import { INTELLIGENCE_ENGINE_NAMES } from "../../../bhudhi/intelligence/types.js";
import {
  frameworkApplicatorEngine,
  contradictionResolutionEngine,
  scenarioSimulatorEngine,
  recommendationEngine,
  findContradictions,
  areContradictory,
  calculateConfidence,
  enrichRecommendation,
  estimateDifficulty,
} from "../../../bhudhi/intelligence/intelligenceEngines.js";
import { evaluateStrategycore, evaluateFramework } from "../../../bhudhi/intelligence/frameworks/frameworkLogic.js";
import type { BhudhiInvestigation } from "@workspace/db/types/bhudhi";

const sampleInvestigations: BhudhiInvestigation[] = [
  {
    id: "inv-1",
    blueprintId: "bp-1",
    engineId: "inv_data_collection",
    subject: "execution",
    findings: {
      patterns: [],
      anomalies: [],
      insights: ["Collected 10 task executions", "Strategy is clear"],
      rootCauses: [],
      benchmarks: {},
    },
    confidence: 0.9,
    severity: "low",
    actionable: true,
  },
];

describe("BHUDHI PROMPT 3 — Intelligence System", () => {
  it("seed defines 12 intelligence engines with Prompt 3 names", () => {
    const intel = BHUDHI_ENGINES.filter((e) => e.systemId === "intelligence");
    expect(intel).toHaveLength(12);
    for (const name of INTELLIGENCE_ENGINE_NAMES) {
      expect(intel.some((e) => e.name === name)).toBe(true);
    }
  });

  it("evaluates STRATEGYCORE framework from investigations", () => {
    const result = evaluateStrategycore(sampleInvestigations);
    expect(result.signal).toBe("stability");
    expect(result.recommendation).toContain("strategic");
  });

  it("evaluates all 14 team frameworks via evaluateFramework", () => {
    const team = BHUDHI_FRAMEWORKS.filter((f) => f.type === "team" && f.id !== "culture_dynamics");
    for (const fw of team) {
      const result = evaluateFramework(fw.name, fw.id, sampleInvestigations);
      expect(result.frameworkId).toBe(fw.id);
      expect(result.confidence).toBeGreaterThan(0);
      expect(Array.isArray(result.insights)).toBe(true);
    }
  });

  it("framework applicator produces analysis per framework", () => {
    const frameworks = BHUDHI_FRAMEWORKS.filter((f) => f.id !== "culture_dynamics").map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      domains: f.domains,
      accuracy: f.accuracy,
      status: "active" as const,
    }));
    const analysis = frameworkApplicatorEngine(sampleInvestigations, frameworks);
    const activeCount = frameworks.filter((f) => f.status === "active").length;
    expect(Object.keys(analysis).length).toBe(activeCount);
  });

  it("resolves contradictory recommendations", () => {
    const analysis = {
      a: {
        frameworkId: "a",
        framework: "A",
        signal: "power" as const,
        confidence: 0.9,
        insights: [],
        recommendation: "Increase marketing spend",
      },
      b: {
        frameworkId: "b",
        framework: "B",
        signal: "danger" as const,
        confidence: 0.5,
        insights: [],
        recommendation: "Decrease marketing spend",
      },
    };
    const resolved = contradictionResolutionEngine(analysis);
    expect(Object.keys(resolved).length).toBe(1);
  });

  it("findContradictions detects increase vs decrease", () => {
    expect(areContradictory("Increase velocity", "Decrease velocity")).toBe(true);
    const pairs = findContradictions(["Increase spend", "Decrease spend"]);
    expect(pairs.length).toBe(1);
  });

  it("runs scenario simulator and recommendation engine", () => {
    const analysis = frameworkApplicatorEngine(sampleInvestigations, [
      {
        id: "strategycore",
        name: "STRATEGYCORE",
        type: "team",
        domains: ["delivery"],
        accuracy: 0.68,
        status: "active",
      },
    ]);
    const resolved = contradictionResolutionEngine(analysis);
    const scenarios = scenarioSimulatorEngine("bp-1", resolved);
    expect(scenarios.conservative.scale).toBe(0.7);
    expect(scenarios.moderate.scale).toBe(1.0);
    expect(scenarios.aggressive.scale).toBe(1.3);

    const recs = recommendationEngine(resolved, scenarios);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]?.title).toBeTruthy();
  });

  it("enriches recommendations with impact, risk, feasibility, alignment", () => {
    const scenarios = scenarioSimulatorEngine("bp-1", {
      strategycore: {
        frameworkId: "strategycore",
        framework: "STRATEGYCORE",
        signal: "stability",
        confidence: 0.8,
        insights: ["Strategy is clear"],
        recommendation: "Continue strategic direction",
      },
    });
    const draft = {
      frameworkId: "strategycore",
      title: "Continue strategic direction",
      description: "Based on STRATEGYCORE",
      reasoning: "Framework detected: Strategy is clear",
      scenario: "moderate" as const,
      confidence: 0.8,
      implementationDifficulty: estimateDifficulty("Continue strategic direction"),
    };
    const enriched = enrichRecommendation(draft, scenarios, 2, 1, true, ["accuracy_improvement"]);
    expect(enriched.expectedImpact.revenue).toBeDefined();
    expect(enriched.risks.probability).toBeGreaterThan(0);
    expect(enriched.feasibility.feasible).toBe(true);
    expect(enriched.strategicAlignment.aligned).toBe(true);
    expect(enriched.learningsUsed).toContain("accuracy_improvement");
    expect(calculateConfidence(enriched, enriched.expectedImpact, enriched.risks, enriched.feasibility, enriched.strategicAlignment)).toBeLessThanOrEqual(1);
  });
});
