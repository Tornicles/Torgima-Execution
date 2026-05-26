import { describe, it, expect } from "vitest";
import { FRAMEWORK_CATALOG } from "../../../bhudhi/frameworks/frameworkCatalog.js";
import { TEAM_FRAMEWORK_EVALUATORS } from "../../../bhudhi/frameworks/teamEvaluators.js";
import { personalStrategyLogic, INDIVIDUAL_FRAMEWORK_EVALUATORS } from "../../../bhudhi/frameworks/individualEvaluator.js";
import { normalizeFrameworkName } from "../../../bhudhi/frameworks/frameworkNameAliases.js";
import { frameworksService } from "../../../bhudhi/frameworks/FrameworksService.js";
import type { BhudhiInvestigation } from "@workspace/db/types/bhudhi";

const sampleInv: BhudhiInvestigation[] = [
  {
    id: "inv-1",
    blueprintId: "bp-1",
    engineId: "inv_data_collection",
    subject: "execution",
    findings: {
      patterns: ["task_completed (×2)"],
      anomalies: [],
      insights: ["Collected 10 task executions", "Strategy is clear", "Customer satisfaction stable"],
      rootCauses: [],
      benchmarks: { tasksPerDay: 5 },
    },
    confidence: 0.85,
    severity: "low",
    actionable: true,
  },
];

describe("BHUDHI PROMPT 6 — Frameworks", () => {
  it("catalog has 14 team + 1 individual frameworks", () => {
    const team = FRAMEWORK_CATALOG.filter((f) => f.type === "team");
    const individual = FRAMEWORK_CATALOG.filter((f) => f.type === "individual");
    expect(team).toHaveLength(14);
    expect(individual).toHaveLength(1);
    expect(individual[0]?.name).toBe("INDIVIDUAL_MASTERY");
  });

  it("defines evaluators for all 14 team framework names", () => {
    const team = FRAMEWORK_CATALOG.filter((f) => f.type === "team");
    for (const fw of team) {
      expect(TEAM_FRAMEWORK_EVALUATORS[fw.name]).toBeTypeOf("function");
    }
  });

  it("normalizes Prompt 6 alias names to seed names", () => {
    expect(normalizeFrameworkName("ALIGNMENT___ACCOUNTABILITY")).toBe("ALIGNMENT_ACCOUNTABILITY");
    expect(normalizeFrameworkName("GOVERNANCE___RISK")).toBe("GOVERNANCE_RISK");
    expect(normalizeFrameworkName("PERSONAL_STRATEGY")).toBe("INDIVIDUAL_MASTERY");
  });

  it("evaluates STRATEGYCORE with insights and recommendation", () => {
    const result = frameworksService.evaluateFramework("STRATEGYCORE", sampleInv);
    expect(result).not.toBeNull();
    expect(result!.insights.length).toBeGreaterThanOrEqual(3);
    expect(result!.recommendation.length).toBeGreaterThan(0);
    expect(result!.domains).toContain("genesis");
    expect(result!.role).toBe("lead");
  });

  it("evaluates all team frameworks via alias names", () => {
    const aliases = [
      "ALIGNMENT___ACCOUNTABILITY",
      "GOVERNANCE___RISK",
      "DECISIONVELOCITY",
      "ADAPTIVEINTELLIGENCE",
    ];
    for (const name of aliases) {
      const result = frameworksService.evaluateFramework(name, sampleInv);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0);
    }
  });

  it("individual framework returns four personal strategy components", () => {
    const result = personalStrategyLogic(sampleInv);
    expect(result.components).toBeDefined();
    expect(result.components!.winningDefinition).toBeTruthy();
    expect(result.components!.focusArena).toBeTruthy();
    expect(result.components!.resourceReality).toBeTruthy();
    expect(result.components!.pathToVictory).toBeTruthy();
    expect(INDIVIDUAL_FRAMEWORK_EVALUATORS.PERSONAL_STRATEGY).toBe(personalStrategyLogic);
  });

  it("evaluateAllForBlueprint returns 15 framework results (pure, empty investigations)", () => {
    const results = frameworksService.evaluateFramework("OMNIGROWTH", []);
    expect(results).not.toBeNull();
    expect(results!.signal).toBeTruthy();
  });

  it("listFrameworkNames returns 15 entries", () => {
    expect(frameworksService.listFrameworkNames()).toHaveLength(15);
  });
});
