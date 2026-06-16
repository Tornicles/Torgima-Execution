import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateThreePaths } from "../../../engines/erector/generateThreePaths.js";
import { resolveConflicts } from "../../../engines/erector/RuleConflictResolver.js";
import { evaluateRulesFromCatalog, evaluateVerdictRule } from "../../../engines/erector/ErectorRuleEngine.js";
import {
  scoreValidationDimensions,
  thresholdRowToTierThresholds,
  buildScoringContext,
} from "../../../engines/erector/ValidationScoringEngine.js";
import type { RealityProfileRow, VerdictRuleRow } from "../../../engines/erector/types/verdict-types.js";

const THRESHOLDS = thresholdRowToTierThresholds({
  tier: "growth",
  proceed_min_score: 70,
  adjust_min_score: 45,
  pivot_max_score: 44,
  market_weight: 0.3,
  demand_weight: 0.3,
  feasibility_weight: 0.25,
  context_weight: 0.15,
  demand_proof_min_class: 3,
});

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

const VR010: VerdictRuleRow = {
  id: "r1",
  rule_id: "VR-010",
  rule_name: "Demand below archetype minimum",
  rule_version: "v0.1",
  applies_to_engine: "validation",
  dimension: "demand",
  condition_description: "demand below min",
  threshold_type: "class_gte",
  threshold_value: { archetype_min: true },
  tier_applicability: ["starter", "growth", "ultimate"],
  severity: "HARD_BLOCKER",
  verdict_effect: "ADJUST",
  correction_required: null,
  revalidation_required: false,
  user_visible_reason: "Demand proof too low",
  bypass_allowed: false,
  active: true,
  created_at: new Date(),
};

describe("erector-validation-orchestrator helpers", () => {
  it("generates three paths with recommended adjusted path for ADJUST verdict", () => {
    const p = profile();
    const scores = scoreValidationDimensions(
      buildScoringContext(p, { missing_fields: [], contradiction_flags: [] }),
      THRESHOLDS,
      "direct_service_delivery",
    );
    const finalVerdict = resolveConflicts(
      evaluateRulesFromCatalog([VR010], "run-1", "user-1", {
        scores,
        thresholds: THRESHOLDS,
        archetype_id: "direct_service_delivery",
        archetype_minimum_demand_class: 3,
        missing_critical_fields: false,
        framework_hard_veto: false,
        resource_goal_mismatch: false,
        matrix_tier: "growth",
      }),
      scores,
      THRESHOLDS,
    );

    const paths = generateThreePaths(p, scores, finalVerdict, {
      archetype_id: "direct_service_delivery",
      minimum_demand_proof_class: 3,
    } as never);

    expect(paths.current.path_type).toBe("current");
    expect(paths.adjusted.path_type).toBe("adjusted");
    expect(paths.alternative.path_type).toBe("alternative");
    expect(paths.adjusted.recommended).toBe(true);
    expect(finalVerdict.verdict).toBe("ADJUST");
  });

  it("blocks current path recommendation for PIVOT verdict", () => {
    const p = profile({ structured_goal: "Launch in 7 days with no budget" });
    const scores = scoreValidationDimensions(
      buildScoringContext(p, { missing_fields: [], contradiction_flags: ["timeline_budget"] }),
      THRESHOLDS,
      "direct_service_delivery",
    );
    scores.feasibility_rating = "blocked";
    scores.overall_validation_score = 30;

    const paths = generateThreePaths(p, scores, {
      verdict: "PIVOT",
      recommended_path: "alternative",
      reasoning: ["Infeasible timeline"],
      correction_fields: ["timeline_launch"],
      requires_correction: true,
      hard_blockers: ["VR-020"],
      soft_warnings: [],
    }, null);

    expect(paths.alternative.recommended).toBe(true);
    expect(paths.current.recommended).toBe(false);
  });
});

vi.mock("@workspace/db", () => {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
    values: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.returning.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);

  return {
    db: { select: vi.fn(() => chain), insert: vi.fn(() => chain), update: vi.fn(() => chain) },
    erectorValidationRuns: { id: "id", user_id: "user_id", verdict: "verdict", tier: "tier", blueprint_id: "blueprint_id" },
    erectorBlueprintLaunchContracts: { validation_run_id: "validation_run_id", consumed: "consumed" },
    blueprints: { id: "id" },
  };
});

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_SIMULATION_REQUESTED: "erector_simulation_requested",
    ERECTOR_LAUNCH_PERMITTED: "erector_launch_permitted",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

vi.mock("../../../engines/erector/erectorStateMachine.js", () => ({
  updateBlueprintErectorState: vi.fn(async () => undefined),
}));

import { db } from "@workspace/db";
import { selectValidationPath } from "../../../services/erector/ErectorPathSelectionService.js";
import { updateBlueprintErectorState } from "../../../engines/erector/erectorStateMachine.js";

describe("selectValidationPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400-equivalent error when selecting current path on PIVOT verdict", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: "run-1", user_id: "user-1", verdict: "PIVOT", tier: "growth", blueprint_id: "bp-1" },
      ]),
    };
    vi.mocked(db.select).mockReturnValue(selectChain as never);

    await expect(
      selectValidationPath({ validationRunId: "run-1", userId: "user-1", selectedPath: "current" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("stores adjusted path and sets PATH_SELECTED state", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: "run-1", user_id: "user-1", verdict: "PROCEED", tier: "starter", blueprint_id: "bp-1" },
      ]),
    };
    vi.mocked(db.select).mockReturnValue(selectChain as never);

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await selectValidationPath({
      validationRunId: "run-1",
      userId: "user-1",
      selectedPath: "adjusted",
    });

    expect(result.path_selected).toBe("adjusted");
    expect(result.next_step).toBe("launch");
    expect(updateBlueprintErectorState).toHaveBeenCalledWith("bp-1", "PATH_SELECTED");
  });
});
