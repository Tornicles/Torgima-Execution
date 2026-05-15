import { describe, it, expect } from "vitest";
import { classifyIndustry } from "../../../engines/validation/intelligence/IndustryClassifier.js";
import { determineIntelligenceVerdict } from "../../../engines/validation/intelligence/VerdictEngine.js";
import { calculateFeasibility } from "../../../engines/validation/intelligence/FeasibilityCalculator.js";
import { buildValidationToBlueprintContract } from "../../../engines/validation/intelligence/ValidationToBlueprintBridge.js";
import { fetchEISIntelligence } from "../../../engines/validation/intelligence/EISService.js";
import { buildCISContext } from "../../../engines/validation/intelligence/CISService.js";

describe("Validation intelligence", () => {
  it("classifies industry from goal text", () => {
    const c = classifyIndustry({ goal: "Build a SaaS app to reach $10k MRR", domainHint: "business" });
    expect(c.industry).toContain("Software");
    expect(c.domain).toBeTruthy();
  });

  it("EIS returns deterministic intelligence without AI", async () => {
    const classification = classifyIndustry({ goal: "Launch ecommerce store selling handmade goods" });
    const cis = buildCISContext({
      blueprintId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      classification,
      tier: "growth",
      mode: "individual",
    });
    const eis = await fetchEISIntelligence({
      goal: "Launch ecommerce store",
      classification,
      cis,
      userId: cis.userId,
      blueprintId: cis.blueprintId,
      aiEnabled: false,
    });
    expect(eis.demand_signal.direction).toBeTruthy();
    expect(eis.competitor_landscape.length).toBeGreaterThan(0);
  });

  it("verdict engine blocks pivot on weak declining demand", () => {
    const eis = {
      demand_signal: { direction: "declining" as const, strength: "weak" as const, evidence: [], demand_type: "speculative" as const },
      saturation_level: "medium" as const,
    };
    const feasibility = calculateFeasibility({
      goal: "vague goal",
      eis: awaitableEis(eis),
      tier: "growth",
    });
    const { verdict, launchBlocked } = determineIntelligenceVerdict({
      eis: awaitableEis(eis),
      feasibility,
      risks: [],
      goal: "make money",
      tier: "growth",
      goalMeasurable: false,
    });
    expect(verdict).toBe("pivot");
    expect(launchBlocked).toBe(true);
  });

  it("builds blueprint contract from intelligence payload shape", () => {
    const intel = minimalIntel();
    const contract = buildValidationToBlueprintContract({
      intelligence: intel,
      selectedPath: "adjusted",
      paths: intel.paths,
      tier: "growth",
    });
    expect(contract.selected_path_type).toBe("adjusted");
    expect(contract.refined_goal).toBeTruthy();
    expect(contract.max_phases).toBeGreaterThan(0);
  });
});

function risingEis() {
  return awaitableEis({
    demand_signal: {
      direction: "rising" as const,
      strength: "moderate" as const,
      evidence: ["x"],
      demand_type: "emerging" as const,
    },
    saturation_level: "medium" as const,
  });
}

function awaitableEis(
  partial: Pick<import("../../../engines/validation/intelligence/validation-intelligence-types.js").EISIntelligence, "demand_signal" | "saturation_level">,
) {
  return {
    industry: "Test",
    niche: "Test",
    domain: "market" as const,
    macro_trends: [],
    micro_trends: [],
    demand_signal: partial.demand_signal,
    saturation_level: partial.saturation_level,
    opportunity_windows: [],
    competitor_landscape: [],
    platform_context: [],
    strategic_windows: [],
    last_updated: new Date().toISOString(),
    confidence_score: 50,
    source: "EIS+fallback" as const,
  };
}

function minimalIntel(): import("../../../engines/validation/intelligence/validation-intelligence-types.js").ValidationIntelligencePayload {
  const eis = risingEis();
  return {
    cis: buildCISContext({
      blueprintId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      classification: classifyIndustry({ goal: "Ship MVP in 90 days with 100 users" }),
      tier: "growth",
      mode: "individual",
    }),
    iis: {
      cleanedGoal: "Reach 100 users in 90 days",
      purpose: "Validate product",
      timeframe: "90 days",
      commitmentLevel: "high" as const,
      currentContext: "",
      successSignals: [],
      blockers: [],
      domainHints: [],
      missingRequiredFields: [],
      ambiguityFlags: [],
      validationVerdict: "VALID" as const,
    },
    eis,
    industryPanel: {
      industryOverview: { industry: "Test", health: "Stable" },
      demandIntelligence: { direction: "rising" },
      competitiveLandscape: { threatLevel: "Medium" },
      executionReality: { successRequires: ["Focus"] },
      riskMap: [],
      strategicWindows: { timing: "now" },
      verdictContext: { mightWork: "yes" },
    },
    tabs: { market: {}, demand: {}, feasibility: {}, context: {} },
    paths: {
      current: {
        type: "current" as const,
        title: "Current",
        summary: "s",
        rationale: "r",
        expectedOutcome: "o",
        riskLevel: "low" as const,
        planSkeleton: { plans: [{ name: "Foundation", description: "d" }], targets: [{ name: "T", type: "primary" }] },
      },
      adjusted: {
        type: "adjusted" as const,
        title: "Adjusted",
        summary: "s",
        rationale: "r",
        expectedOutcome: "o",
        riskLevel: "medium" as const,
        planSkeleton: { plans: [{ name: "Foundation", description: "d" }], targets: [{ name: "T", type: "primary" }] },
      },
      alternative: {
        type: "alternative" as const,
        title: "Alt",
        summary: "s",
        rationale: "r",
        expectedOutcome: "o",
        riskLevel: "low" as const,
        planSkeleton: { plans: [{ name: "MVP", description: "d" }], targets: [{ name: "T", type: "vital" }] },
      },
    },
    feasibility: calculateFeasibility({
      goal: "Reach 100 users in 90 days",
      timeframe: "90 days",
      eis,
      tier: "growth",
    }),
    pis: { risk_flags: [], predicted_obstacles: [], strategic_assumptions: [] },
    verdict: "proceed" as const,
    verdictReasoning: "ok",
    readiness: "ready_proceed" as const,
    launchBlocked: false,
    tier: "growth" as const,
    systemsProgress: {},
  };
}
