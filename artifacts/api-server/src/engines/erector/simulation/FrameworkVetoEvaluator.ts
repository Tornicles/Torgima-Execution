import type { ArchetypeRulePack } from "../economic/types.js";
import type { MatrixTier, RealityProfileRow } from "../types/verdict-types.js";
import type { FrameworkVerdictResult, SimulationScoringInput } from "./types.js";

const GROWTH_FRAMEWORKS = new Set(["customer_value", "governance_risk"]);
const ALL_FRAMEWORKS = ["strategy_core", "customer_value", "synergy_ops", "governance_risk"] as const;

function parseTimelineDays(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return Math.max(0, Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24)));
  }
  const lower = value.toLowerCase();
  const dayMatch = lower.match(/(\d+)\s*day/);
  if (dayMatch) return Number(dayMatch[1]);
  const weekMatch = lower.match(/(\d+)\s*week/);
  if (weekMatch) return Number(weekMatch[1]) * 7;
  const monthMatch = lower.match(/(\d+)\s*month/);
  if (monthMatch) return Number(monthMatch[1]) * 30;
  return null;
}

function evaluateStrategyCore(
  profile: RealityProfileRow,
  rulePack: ArchetypeRulePack,
  selectedPath: string | null | undefined,
): FrameworkVerdictResult {
  const goal = (profile.structured_goal ?? "").toLowerCase();
  const path = (selectedPath ?? "current").toLowerCase();
  const archetype = rulePack.archetype_id;

  const goalMarketplace = /\b(marketplace|exchange|two-sided)\b/.test(goal);
  const pathConsulting = path === "alternative" || /\bconsult/.test(goal);
  const archetypeMismatch =
    goalMarketplace && pathConsulting && archetype !== "consulting_advisory";

  return {
    framework_id: "strategy_core",
    framework_name: "StrategyCore",
    veto_type: archetypeMismatch ? "HARD_VETO" : "PASSED",
    verdict_effect: archetypeMismatch ? "PIVOT" : "NONE",
    condition_met: archetypeMismatch,
    user_visible_reason: archetypeMismatch
      ? "Your strategy needs sharper positioning before we can proceed."
      : "Strategy coherence is acceptable for the selected path.",
    correction_required: archetypeMismatch
      ? "Realign path with goal before launch"
      : null,
  };
}

function evaluateCustomerValue(input: SimulationScoringInput): FrameworkVerdictResult {
  const demandLow =
    input.demandProofClass < input.rulePack.minimum_demand_proof_class &&
    input.payingForAlternatives !== true &&
    input.marketViabilityScore < 40;

  return {
    framework_id: "customer_value",
    framework_name: "CustomerValue",
    veto_type: demandLow ? "HARD_VETO" : "PASSED",
    verdict_effect: demandLow ? "PIVOT" : "NONE",
    condition_met: demandLow,
    user_visible_reason: demandLow
      ? "We need clearer proof that customers will pay for this."
      : "Customer value proof meets simulation requirements.",
    correction_required: demandLow
      ? "Collect stronger customer validation evidence"
      : null,
  };
}

function evaluateSynergyOps(
  profile: RealityProfileRow,
  rulePack: ArchetypeRulePack,
): FrameworkVerdictResult {
  const timelineDays = parseTimelineDays(profile.timeline_launch);
  const hardVeto =
    (profile.hours_per_week ?? 0) < 3 &&
    rulePack.capital_pressure === "high" &&
    profile.team_size === 1 &&
    timelineDays !== null &&
    timelineDays < 60;

  return {
    framework_id: "synergy_ops",
    framework_name: "SynergyOps",
    veto_type: hardVeto ? "HARD_VETO" : "PASSED",
    verdict_effect: hardVeto ? "ADJUST" : "NONE",
    condition_met: hardVeto,
    user_visible_reason: hardVeto
      ? "Your timeline does not match your available operational capacity."
      : "Operational capacity is sufficient for the stated plan.",
    correction_required: hardVeto ? "Adjust timeline or resource plan" : null,
  };
}

function evaluateGovernance(profile: RealityProfileRow): FrameworkVerdictResult {
  const flags = profile.regulatory_flags ?? [];
  const hardFlags = ["illegal", "unlicensed_required", "safety_critical_unaddressed"];
  const hardHit = hardFlags.some((flag) => flags.includes(flag));
  const softHit = flags.includes("compliance_review_recommended");

  if (hardHit) {
    return {
      framework_id: "governance_risk",
      framework_name: "Governance & Risk",
      veto_type: "HARD_VETO",
      verdict_effect: "PIVOT",
      condition_met: true,
      user_visible_reason: "A compliance or governance risk must be addressed before launch.",
      correction_required: "Resolve compliance blockers or change model",
    };
  }

  if (softHit) {
    return {
      framework_id: "governance_risk",
      framework_name: "Governance & Risk",
      veto_type: "SOFT_VETO",
      verdict_effect: "ADJUST",
      condition_met: true,
      user_visible_reason: "Compliance review is recommended before scaling.",
      correction_required: "Complete compliance review",
    };
  }

  return {
    framework_id: "governance_risk",
    framework_name: "Governance & Risk",
    veto_type: "PASSED",
    verdict_effect: "NONE",
    condition_met: false,
    user_visible_reason: "No unresolved governance or regulatory blockers detected.",
    correction_required: null,
  };
}

export function evaluateFrameworkVetoes(
  input: SimulationScoringInput,
  tier: MatrixTier,
): FrameworkVerdictResult[] {
  const activeFrameworks =
    tier === "growth"
      ? ALL_FRAMEWORKS.filter((id) => GROWTH_FRAMEWORKS.has(id))
      : [...ALL_FRAMEWORKS];

  const verdicts: FrameworkVerdictResult[] = [];

  if (activeFrameworks.includes("strategy_core")) {
    verdicts.push(
      evaluateStrategyCore(input.profile, input.rulePack, input.selectedPath),
    );
  }
  if (activeFrameworks.includes("customer_value")) {
    verdicts.push(evaluateCustomerValue(input));
  }
  if (activeFrameworks.includes("synergy_ops")) {
    verdicts.push(evaluateSynergyOps(input.profile, input.rulePack));
  }
  if (activeFrameworks.includes("governance_risk")) {
    verdicts.push(evaluateGovernance(input.profile));
  }

  return verdicts;
}
