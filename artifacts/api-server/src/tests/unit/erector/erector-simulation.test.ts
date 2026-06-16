import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RealityProfileRow } from "../../../engines/erector/types/verdict-types.js";
import type { ArchetypeRulePack } from "../../../engines/erector/economic/types.js";

function profile(overrides: Partial<RealityProfileRow> = {}): RealityProfileRow {
  return {
    id: "profile-1",
    user_id: "user-1",
    intake_session_id: "sess-1",
    structured_goal: "B2B SaaS for finance teams",
    goal_measurable_outcome: "10 paying customers",
    structured_purpose: { target_who: "SMB finance leads" },
    industry: "SaaS",
    location: "US",
    market_scope: "national",
    operating_context: "formal",
    revenue_model: "subscription",
    price_range: "$99/mo",
    business_type: "SaaS",
    budget_range: "$5000",
    budget_usd_estimate: 5000,
    hours_per_week: 20,
    team_size: 1,
    skills_present: [],
    skills_missing: [],
    timeline_launch: "2026-09-01",
    timeline_customers: "2026-10-01",
    timeline_final: "2027-03-01",
    known_blockers: [],
    prior_attempts: [],
    regulatory_flags: [],
    success_30_days: null,
    success_90_days: null,
    success_12_months: null,
    payment_infrastructure: "digital_full",
    market_maturity: "established",
    internet_reliability: "high",
    profile_model_version: "v0.1",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function saasRulePack(): ArchetypeRulePack {
  return {
    id: "pack-1",
    archetype_id: "saas_platform",
    archetype_name: "SaaS Platform",
    archetype_version: "v0.1",
    core_risk: "build cost + retention",
    risk_level: "high",
    minimum_demand_proof_class: 4,
    demand_proof_description: "Paid pilot or LOI",
    proof_required: [],
    proof_description: "Paid pilot",
    common_failure_modes: ["churn before PMF", "build cost overrun"],
    false_progress_patterns: [],
    capital_pressure: "high",
    capital_range_usd_min: null,
    capital_range_usd_max: null,
    timeline_pressure: "high",
    typical_months_to_traction: 18,
    validation_blockers: [],
    required_phase_gates: [],
    correction_path_templates: [],
    starter_adjustments: {},
    growth_adjustments: {},
    ultimate_adjustments: {},
    active: true,
    created_at: new Date(),
    tier_adjustments_applied: {},
  };
}

vi.mock("@workspace/db", () => {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    set: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.returning.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);

  return {
    db: { select: vi.fn(() => chain), insert: vi.fn(() => chain), update: vi.fn(() => chain) },
    erectorResimulationRuns: { id: "id" },
    erectorSimulationRuns: { id: "id", blueprint_id: "blueprint_id" },
    erectorValidationRuns: { id: "id", user_id: "user_id" },
    erectorArchetypeClassifications: { validation_run_id: "validation_run_id" },
    erectorUserRealityProfiles: { id: "id", intake_session_id: "intake_session_id" },
    erectorBlueprintLaunchContracts: { validation_run_id: "validation_run_id", consumed: "consumed" },
    erectorCorrectionPaths: { id: "id" },
    erectorDecisionAudits: { decision_id: "decision_id" },
    blueprints: { id: "id", erector_simulation_id: "erector_simulation_id" },
  };
});

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_LAUNCH_PERMITTED: "erector_launch_permitted",
    ERECTOR_SIMULATION_COMPLETED: "erector_simulation_completed",
    ERECTOR_RESIMULATION_WARNING: "erector_resimulation_warning",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

vi.mock("../../../engines/erector/erectorStateMachine.js", () => ({
  updateBlueprintErectorState: vi.fn(async () => undefined),
}));

vi.mock("../../../engines/erector/economic/ArchetypeRulePackLoader.js", () => ({
  loadArchetypeRulePack: vi.fn(async () => saasRulePack()),
}));

import { calculateSimulationScores } from "../../../engines/erector/simulation/SimulationScoringEngine.js";
import { generateScenarios } from "../../../engines/erector/simulation/ScenarioGenerator.js";
import { evaluateFrameworkVetoes } from "../../../engines/erector/simulation/FrameworkVetoEvaluator.js";
import {
  createResimulationRun,
  detectResimulationTriggers,
} from "../../../engines/erector/simulation/ResimulationTriggerSystem.js";
import { runSimulationOrchestrator } from "../../../engines/erector/simulation/ErectorSimulationOrchestrator.js";
import { updateBlueprintErectorState } from "../../../engines/erector/erectorStateMachine.js";
import { db } from "@workspace/db";

describe("simulation scoring engine", () => {
  it("returns probabilities that sum to 100", () => {
    const scores = calculateSimulationScores({
      profile: profile(),
      rulePack: saasRulePack(),
      tier: "growth",
      demandProofClass: 4,
      marketViabilityScore: 75,
      feasibilityRating: "strongly_feasible",
    });

    expect(
      scores.probability_proceed + scores.probability_adjust + scores.probability_failure,
    ).toBe(100);
  });

  it("Growth SaaS good inputs yield probability_proceed >= 40%", () => {
    const scores = calculateSimulationScores({
      profile: profile({ prior_attempts: ["prior launch"] }),
      rulePack: saasRulePack(),
      tier: "growth",
      demandProofClass: 5,
      marketViabilityScore: 85,
      feasibilityRating: "strongly_feasible",
    });

    expect(scores.probability_proceed).toBeGreaterThanOrEqual(40);
  });
});

describe("simulation scenario generator", () => {
  it("generates 3 scenarios with probabilities from scores", () => {
    const scores = calculateSimulationScores({
      profile: profile(),
      rulePack: saasRulePack(),
      tier: "growth",
      demandProofClass: 4,
      marketViabilityScore: 80,
      feasibilityRating: "strongly_feasible",
    });
    const scenarios = generateScenarios(scores, profile(), saasRulePack());

    expect(scenarios.best_case.probability).toBe(scores.probability_proceed);
    expect(scenarios.base_case.probability).toBe(scores.probability_adjust);
    expect(scenarios.downside.probability).toBe(scores.probability_failure);
    expect(scenarios.best_case.warning_triggers.length).toBeGreaterThan(0);
    expect(scenarios.downside.failure_modes.length).toBeGreaterThan(0);
  });
});

describe("simulation framework veto evaluator", () => {
  it("Growth tier evaluates CustomerValue and Governance only", () => {
    const verdicts = evaluateFrameworkVetoes(
      {
        profile: profile(),
        rulePack: saasRulePack(),
        tier: "growth",
        demandProofClass: 5,
        marketViabilityScore: 85,
        feasibilityRating: "strongly_feasible",
      },
      "growth",
    );

    expect(verdicts).toHaveLength(2);
    expect(verdicts.map((v) => v.framework_id).sort()).toEqual([
      "customer_value",
      "governance_risk",
    ]);
    expect(verdicts.every((v) => v.veto_type === "PASSED")).toBe(true);
  });

  it("Ultimate Governance HARD_VETO fires for unlicensed_required", () => {
    const verdicts = evaluateFrameworkVetoes(
      {
        profile: profile({ regulatory_flags: ["unlicensed_required"] }),
        rulePack: saasRulePack(),
        tier: "ultimate",
        demandProofClass: 5,
        marketViabilityScore: 85,
        feasibilityRating: "strongly_feasible",
      },
      "ultimate",
    );

    const governance = verdicts.find((v) => v.framework_id === "governance_risk");
    expect(governance?.veto_type).toBe("HARD_VETO");
    expect(governance?.verdict_effect).toBe("PIVOT");
    expect(verdicts).toHaveLength(4);
  });
});

describe("simulation resimulation trigger system", () => {
  it("fires signal_shift_detector when outcome_movement drops 30 points", () => {
    const triggers = detectResimulationTriggers({
      tier: "growth",
      blueprintActiveDays: 30,
      outcomeMovementDelta14d: -30,
      demandSignalDelta: 0,
      highEvidenceSubmittedLast7d: false,
      falseProgressSignal: 0,
      openHighSeverityFlags: 0,
      consecutivePhaseGateFailures: 0,
      marketSignalDelta7d: 0,
    });

    expect(triggers).toContain("signal_shift_detector");
  });

  it("fires all 5 trigger conditions when thresholds are met", () => {
    const triggers = detectResimulationTriggers({
      tier: "ultimate",
      blueprintActiveDays: 30,
      outcomeMovementDelta14d: -30,
      demandSignalDelta: -25,
      highEvidenceSubmittedLast7d: true,
      falseProgressSignal: 75,
      openHighSeverityFlags: 2,
      consecutivePhaseGateFailures: 2,
      marketSignalDelta7d: -35,
    });

    expect(triggers).toEqual([
      "signal_shift_detector",
      "demand_change_detector",
      "false_progress_trigger",
      "phase_gate_failure_trigger",
      "market_context_change_trigger",
    ]);
  });
});

describe("simulation orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects Starter tier without running simulation", async () => {
    await expect(
      runSimulationOrchestrator("run-1", "user-1", "bp-1", "authenticated"),
    ).rejects.toThrow("SIMULATION_NOT_REQUIRED_FOR_STARTER");
  });

  it("Ultimate governance veto sets LAUNCH_BLOCKED and opens PIVOT_REQUIRED correction", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      orderBy: vi.fn().mockReturnThis(),
    };

    selectChain.limit
      .mockResolvedValueOnce([
        {
          id: "run-1",
          user_id: "user-1",
          intake_session_id: "sess-1",
          reality_profile_id: "profile-1",
          demand_proof_class: 5,
          market_viability_score: 85,
          feasibility_rating: "strongly_feasible",
          selected_path: "current",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "class-1",
          primary_archetype: "saas_platform",
          secondary_archetype: null,
          classification_confidence: "0.85",
        },
      ])
      .mockResolvedValueOnce([profile({ regulatory_flags: ["unlicensed_required"] })]);

    vi.mocked(db.select).mockReturnValue(selectChain as never);

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "sim-1" }]),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await runSimulationOrchestrator("run-1", "user-1", "bp-1", "ultimate");

    expect(result.verdict).toBe("BLOCKED");
    expect(updateBlueprintErectorState).toHaveBeenCalledWith("bp-1", "LAUNCH_BLOCKED");
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ correction_type: "PIVOT_REQUIRED" }),
    );
  });
});

describe("simulation resimulation persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates erector_resimulation_runs row with probability_delta", async () => {
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "resim-1" }]),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const result = await createResimulationRun({
      userId: "user-1",
      blueprintId: "bp-1",
      originalSimulationId: "sim-1",
      triggerType: "signal_shift_detector",
      triggerDescription: "Outcome movement dropped 30 points",
      scoringInput: {
        profile: profile(),
        rulePack: saasRulePack(),
        tier: "growth",
        demandProofClass: 2,
        marketViabilityScore: 35,
        feasibilityRating: "unlikely",
      },
      changedInputs: { outcome_movement_delta: -30 },
      previousProbability: 60,
      previousVerdict: "PERMITTED",
    });

    expect(result.resimulationId).toBe("resim-1");
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_probability: 60,
        probability_delta: expect.any(Number),
        updated_probability: expect.any(Number),
      }),
    );
  });
});
