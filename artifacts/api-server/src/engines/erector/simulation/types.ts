import type { ArchetypeRulePack } from "../economic/types.js";
import type { MatrixTier, RealityProfileRow } from "../types/verdict-types.js";

export interface EconomicConstraintSummary {
  archetype_baseline_pct: number;
  modifier_total_pct: number;
  modifiers_applied: string[];
  capital_pressure: string;
  timeline_pressure: string;
}

export interface CivilizationConstraintSummary {
  market_maturity: string | null;
  operating_context: string | null;
  internet_reliability: string | null;
  payment_infrastructure: string | null;
  regulatory_flags: string[];
}

export interface SimulationScores {
  probability_proceed: number;
  probability_adjust: number;
  probability_failure: number;
  simulation_confidence: "LOW" | "MEDIUM" | "HIGH";
  economic_constraints: EconomicConstraintSummary;
  civilization_constraints: CivilizationConstraintSummary;
}

export interface ScenarioBundle {
  best_case: {
    description: string;
    probability: number;
    timeline_adj: string;
    conditions: string[];
    risks: string[];
    warning_triggers: string[];
  };
  base_case: {
    description: string;
    probability: number;
    timeline_adj: string;
    risks: string[];
    blockers: string[];
  };
  downside: {
    description: string;
    probability: number;
    timeline_adj: string;
    failure_modes: string[];
    correction_path: string;
  };
}

export interface FrameworkVerdictResult {
  framework_id: string;
  framework_name: string;
  veto_type: "HARD_VETO" | "SOFT_VETO" | "PASSED" | "ADVISE";
  verdict_effect: "PIVOT" | "ADJUST" | "NONE";
  condition_met: boolean;
  user_visible_reason: string;
  correction_required: string | null;
}

export interface SimulationScoringInput {
  profile: RealityProfileRow;
  rulePack: ArchetypeRulePack;
  tier: MatrixTier;
  demandProofClass: number;
  marketViabilityScore: number;
  feasibilityRating: string | null;
  payingForAlternatives?: boolean | null;
  selectedPath?: string | null;
}

export interface SimulationOrchestratorResult {
  simulation_run_id: string;
  verdict: "BLOCKED" | "PERMITTED";
  scores: SimulationScores;
  scenarios: ScenarioBundle;
  framework_verdicts: FrameworkVerdictResult[];
}

export type ResimulationTriggerType =
  | "signal_shift_detector"
  | "demand_change_detector"
  | "false_progress_trigger"
  | "phase_gate_failure_trigger"
  | "market_context_change_trigger";

export interface ResimulationContext {
  tier: string;
  blueprintActiveDays: number;
  outcomeMovementDelta14d: number;
  demandSignalDelta: number;
  highEvidenceSubmittedLast7d: boolean;
  falseProgressSignal: number;
  openHighSeverityFlags: number;
  consecutivePhaseGateFailures: number;
  marketSignalDelta7d: number;
}
