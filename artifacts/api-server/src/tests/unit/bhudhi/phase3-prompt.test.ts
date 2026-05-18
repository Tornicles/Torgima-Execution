/**
 * BHUDHI_CURSOR_PROMPT_3 — Validation engine + industry intelligence
 */
import { describe, it, expect } from "vitest";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import { determineIntelligenceVerdict } from "../../../engines/validation/intelligence/VerdictEngine.js";
import { classifyIndustry } from "../../../engines/validation/intelligence/IndustryClassifier.js";
import {
  buildValidationToBlueprintContract,
  applyContractToChainSkeleton,
} from "../../../engines/validation/intelligence/ValidationToBlueprintBridge.js";
import { applyTierDepthToResult } from "../../../engines/validation/intelligence/applyTierDepth.js";
import { fetchEISIntelligence, buildIndustryIntelligencePanel } from "../../../engines/validation/intelligence/EISService.js";
import { buildCISContext } from "../../../engines/validation/intelligence/CISService.js";
import { isGoalMeasurable } from "../../../engines/validation/intelligence/IISService.js";
import { generateStrategicPaths } from "../../../engines/validation/intelligence/SISService.js";
import { runPIS } from "../../../engines/validation/intelligence/PISService.js";
import { calculateFeasibility } from "../../../engines/validation/intelligence/FeasibilityCalculator.js";
import { scoreGoal } from "../../../engines/validation/ValidationEngine.js";
import type {
  EISIntelligence,
  FullValidationResult,
  ValidationIntelligencePayload,
} from "../../../engines/validation/intelligence/validation-intelligence-types.js";
import type { StructuredGoalDraft } from "../../../types/validation.js";

describe("Prompt 3 — Bhudhi validation contracts", () => {
  it("registers EIS_INDUSTRY_RESEARCH and DOMAIN_RESOLUTION", () => {
    expect(getContract("EIS_INDUSTRY_RESEARCH")?.name).toBe("EIS_INDUSTRY_RESEARCH");
    expect(getContract("DOMAIN_RESOLUTION")?.name).toBe("domain.resolve.v1");
  });
});

describe("Prompt 3 — Five intelligence systems (unit)", () => {
  const classification = classifyIndustry({ goal: "Launch a B2B SaaS to $5k MRR in 12 months" });
  const cis = buildCISContext({
    blueprintId: "00000000-0000-4000-8000-000000000010",
    userId: "00000000-0000-4000-8000-000000000011",
    classification,
    tier: "growth",
    mode: "individual",
  });

  it("CIS builds execution context", () => {
    expect(cis.industry).toBeTruthy();
    expect(cis.domain).toBeTruthy();
  });

  it("EIS returns all 7 industry intelligence blocks", async () => {
    const eis = await fetchEISIntelligence({
      goal: "Launch B2B SaaS",
      classification,
      cis,
      userId: cis.userId,
      blueprintId: cis.blueprintId,
      aiEnabled: false,
    });
    const panel = buildIndustryIntelligencePanel(eis, "Launch B2B SaaS");
    expect(panel.industryOverview.industry).toBeTruthy();
    expect(panel.demandIntelligence.direction).toBeTruthy();
    expect(panel.competitiveLandscape.threatLevel).toBeTruthy();
    expect(panel.executionReality.successRequires.length).toBeGreaterThan(0);
    expect(panel.riskMap.length).toBeGreaterThan(0);
    expect(panel.strategicWindows.timing).toBeTruthy();
    expect(panel.verdictContext.mightWork.length).toBeGreaterThan(0);
  });

  it("SIS generates three distinct paths", async () => {
    const eis = strongEis();
    const iis = sampleIis();
    const feasibility = calculateFeasibility({
      goal: iis.cleanedGoal,
      timeframe: iis.timeframe,
      commitmentLevel: iis.commitmentLevel,
      eis,
      tier: "growth",
    });
    const scores = scoreGoal({
      goal: iis.cleanedGoal,
      purpose: iis.purpose,
      timeframe: iis.timeframe,
      commitmentLevel: iis.commitmentLevel,
    });
    const paths = await generateStrategicPaths({
      blueprintId: cis.blueprintId,
      userId: cis.userId,
      goal: iis.cleanedGoal,
      purpose: iis.purpose,
      timeframe: iis.timeframe,
      commitmentLevel: iis.commitmentLevel,
      scores,
      verdict: "proceed",
      eis,
      feasibility,
      iis,
      tier: "growth",
      aiEnabled: false,
    });
    expect(paths.current.summary).toBeTruthy();
    expect(paths.adjusted.summary).toBeTruthy();
    expect(paths.alternative.summary).toBeTruthy();
    expect(paths.adjusted.summary).not.toBe(paths.current.summary);
  });

  it("PIS produces risk flags and ultimate probability", () => {
    const eis = strongEis();
    const feasibility = calculateFeasibility({
      goal: "Reach $5k MRR",
      eis,
      tier: "ultimate",
    });
    const pis = runPIS({ goal: "Reach $5k MRR", eis, feasibility, tier: "ultimate" });
    expect(pis.risk_flags.length).toBeGreaterThan(0);
    expect(pis.probability_score).toBeGreaterThan(0);
  });
});

describe("Prompt 3 — Verdict engine (doc test cases)", () => {
  it("vague goal forces pivot", () => {
    const { verdict, launchBlocked } = determineIntelligenceVerdict({
      eis: weakEis(),
      feasibility: sampleFeasibility(15),
      risks: [],
      goal: "money",
      tier: "growth",
      goalMeasurable: false,
    });
    expect(verdict).toBe("pivot");
    expect(launchBlocked).toBe(true);
  });

  it("declining weak demand blocks launch", () => {
    const { verdict, launchBlocked } = determineIntelligenceVerdict({
      eis: {
        ...weakEis(),
        demand_signal: {
          direction: "declining",
          strength: "weak",
          evidence: [],
          demand_type: "speculative",
        },
      },
      feasibility: sampleFeasibility(50),
      risks: [],
      goal: "Build a product business with clear metrics",
      tier: "growth",
      goalMeasurable: true,
    });
    expect(verdict).toBe("pivot");
    expect(launchBlocked).toBe(true);
  });

  it("strong demand + feasibility yields proceed", () => {
    const { verdict, launchBlocked } = determineIntelligenceVerdict({
      eis: strongEis(),
      feasibility: sampleFeasibility(55),
      risks: [],
      goal: "Reach $10k MRR in 12 months with a B2B SaaS",
      tier: "growth",
      goalMeasurable: true,
    });
    expect(verdict).toBe("proceed");
    expect(launchBlocked).toBe(false);
  });

  it("non-measurable goal on growth tier yields adjust", () => {
    const goal = "do something cool";
    const { verdict } = determineIntelligenceVerdict({
      eis: strongEis(),
      feasibility: sampleFeasibility(55),
      risks: [],
      goal,
      tier: "growth",
      goalMeasurable: isGoalMeasurable(goal),
    });
    expect(verdict).toBe("adjust");
  });
});

describe("Prompt 3 — ValidationToBlueprint pipeline", () => {
  it("speculative demand adds proof-of-demand skeleton", () => {
    const intel = buildIntelPayload();
    intel.eis.demand_signal.demand_type = "speculative";
    intel.eis.demand_signal.strength = "weak";
    const contract = buildValidationToBlueprintContract({
      intelligence: intel,
      selectedPath: "current",
      paths: intel.paths,
      tier: "growth",
    });
    expect(contract.demand_validation_required).toBe(true);
    const skeleton = applyContractToChainSkeleton(contract);
    expect(skeleton.plans.some((p) => /demand|proof/i.test(p.name))).toBe(true);
  });

  it("alternative path + obstacles shape blueprint skeleton", () => {
    const intel = buildIntelPayload();
    intel.pis.predicted_obstacles = ["Platform dependency risk"];
    const contract = buildValidationToBlueprintContract({
      intelligence: intel,
      selectedPath: "alternative",
      paths: intel.paths,
      tier: "ultimate",
    });
    expect(contract.selected_path_type).toBe("alternative");
    const skeleton = applyContractToChainSkeleton(contract);
    expect(skeleton.targets.some((t) => /prevent/i.test(t.name))).toBe(true);
  });
});

describe("Prompt 3 — Tier enforcement", () => {
  it("starter condenses panel and hides ultimate probability", () => {
    const intel = buildIntelPayload();
    const full: FullValidationResult = {
      validationId: "v1",
      blueprintId: "b1",
      verdict: "proceed",
      scores: scoreGoal({
        goal: intel.iis.cleanedGoal,
        purpose: intel.iis.purpose,
        timeframe: intel.iis.timeframe,
        commitmentLevel: intel.iis.commitmentLevel,
      }),
      paths: intel.paths,
      intelligence: intel,
      blueprintContract: null,
      usedFallback: true,
      launchBlocked: false,
      readiness: "ready_proceed",
      createdAt: new Date(),
    };
    const starter = applyTierDepthToResult(full, "starter");
    expect(starter.intelligence.pis.probability_score).toBeUndefined();
    expect(starter.intelligence.industryPanel.riskMap.length).toBeLessThanOrEqual(2);
  });
});

function sampleIis(): StructuredGoalDraft {
  return {
    cleanedGoal: "Reach $5k MRR with a focused B2B SaaS",
    purpose: "Revenue",
    timeframe: "12 months",
    commitmentLevel: "high",
    currentContext: "",
    successSignals: [],
    blockers: [],
    domainHints: [],
    missingRequiredFields: [],
    ambiguityFlags: [],
    validationVerdict: "VALID",
  };
}

function weakEis(): EISIntelligence {
  return {
    industry: "General",
    niche: "General",
    domain: "market",
    demand_signal: {
      direction: "declining",
      strength: "weak",
      evidence: [],
      demand_type: "speculative",
    },
    saturation_level: "critical",
    macro_trends: [],
    micro_trends: [],
    opportunity_windows: [],
    competitor_landscape: [],
    platform_context: [],
    strategic_windows: [],
    last_updated: new Date().toISOString(),
    confidence_score: 25,
    source: "EIS",
  };
}

function strongEis(): EISIntelligence {
  return {
    industry: "Software",
    niche: "B2B",
    domain: "market",
    demand_signal: {
      direction: "rising",
      strength: "moderate",
      evidence: ["validated demand"],
      demand_type: "proven",
    },
    saturation_level: "medium",
    macro_trends: [],
    micro_trends: [],
    opportunity_windows: [],
    competitor_landscape: [],
    platform_context: [],
    strategic_windows: [],
    last_updated: new Date().toISOString(),
    confidence_score: 75,
    source: "EIS",
  };
}

function sampleFeasibility(score: number) {
  return calculateFeasibility({
    goal: "Reach $5k MRR",
    eis: strongEis(),
    tier: "growth",
  });
}

function samplePath(
  type: "current" | "adjusted" | "alternative",
  summary: string,
  planName: string,
  keyChanges?: string,
) {
  return {
    type,
    title: `${type} path`,
    summary,
    rationale: "Test rationale",
    expectedOutcome: "Measurable progress",
    riskLevel: "medium" as const,
    keyChanges,
    planSkeleton: {
      plans: [{ name: planName, description: "Primary plan" }],
      targets: [{ name: "Target 1", type: "vital" }],
    },
  };
}

function buildIntelPayload(): ValidationIntelligencePayload {
  const eis = strongEis();
  const iis = sampleIis();
  const feasibility = calculateFeasibility({
    goal: iis.cleanedGoal,
    timeframe: iis.timeframe,
    commitmentLevel: iis.commitmentLevel,
    eis,
    tier: "growth",
  });
  const paths = {
    current: samplePath("current", "Current path summary", "Plan A"),
    adjusted: samplePath("adjusted", "Adjusted path summary", "Plan B", "Scope tightened"),
    alternative: samplePath("alternative", "Alternative path summary", "Plan C"),
  };
  return {
    tier: "growth",
    verdict: "proceed",
    verdictReasoning: "ok",
    readiness: "ready_proceed",
    launchBlocked: false,
    cis: buildCISContext({
      blueprintId: "b",
      userId: "u",
      classification: classifyIndustry({ goal: iis.cleanedGoal }),
      tier: "growth",
      mode: "individual",
    }),
    iis,
    eis,
    feasibility,
    pis: runPIS({ goal: iis.cleanedGoal, eis, feasibility, tier: "growth" }),
    paths,
    industryPanel: buildIndustryIntelligencePanel(eis, iis.cleanedGoal),
    tabs: {
      market: { industryPosition: "B2B" },
      demand: { demandSignal: "rising" },
      feasibility: { feasibilityScore: String(feasibility.score) },
      context: { entryPoint: "optimal" },
    },
    systemsProgress: {
      CIS: "complete",
      IIS: "complete",
      EIS: "complete",
      SIS: "complete",
      PIS: "complete",
    },
  };
}
