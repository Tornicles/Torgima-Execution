import type { InferSelectModel } from "drizzle-orm";
import type {
  erectorThresholdMatrix,
  erectorUserRealityProfiles,
  erectorVerdictRules,
} from "@workspace/db";

export type RealityProfileRow = InferSelectModel<typeof erectorUserRealityProfiles>;
export type VerdictRuleRow = InferSelectModel<typeof erectorVerdictRules>;
export type ThresholdMatrixRow = InferSelectModel<typeof erectorThresholdMatrix>;

export type MatrixTier = "starter" | "growth" | "ultimate";
export type ErectorVerdict = "PROCEED" | "ADJUST" | "PIVOT";
export type VerdictEffect = "NONE" | "ADJUST" | "PIVOT";

export interface DimensionScores {
  market_viability_score: number;
  demand_proof_score: number;
  feasibility_score: number;
  context_readiness_score: number;
  contradiction_score: number;
  evidence_quality_score: number;
  overall_validation_score: number;
  demand_proof_class: number;
  feasibility_rating: string;
  /** Gap Fix 1 — free 5-question intake preview runs only. */
  is_free_tier_preview?: boolean;
  confidence_score?: number;
}

export interface TierThresholds {
  tier: MatrixTier;
  proceed_min_score: number;
  adjust_min_score: number;
  pivot_max_score: number;
  market_weight: number;
  demand_weight: number;
  feasibility_weight: number;
  context_weight: number;
  demand_proof_min_class: number;
}

export interface ScoringContext {
  profile: RealityProfileRow;
  missing_fields: string[];
  contradiction_flags: string[];
  paying_for_alternatives: boolean | null;
  problem_urgency: string | null;
  target_who: string | null;
  differentiation: string | null;
  competitors: string[];
}

export interface ErectorVerdictDecisionInsert {
  validation_run_id: string;
  user_id: string;
  rule_id: string;
  dimension: string;
  input_value: Record<string, unknown>;
  threshold_compared: Record<string, unknown>;
  severity: string;
  verdict_effect: string;
  fired: boolean;
  rule_version: string;
}

export interface RuleEvaluationResult {
  rules_evaluated: number;
  rules_fired: string[];
  hard_blockers: string[];
  soft_blockers: string[];
  soft_warnings: string[];
  verdict_effects: Array<{ rule_id: string; effect: VerdictEffect }>;
  decisions_to_write: ErectorVerdictDecisionInsert[];
  framework_hard_veto: boolean;
  free_tier_verdict?: ErectorVerdict;
  free_tier_note?: string;
  upgrade_required_for_full_validation?: boolean;
}

export interface FinalVerdictDecision {
  verdict: ErectorVerdict;
  recommended_path: "current" | "adjusted" | "alternative";
  reasoning: string[];
  correction_fields: string[];
  requires_correction: boolean;
  hard_blockers: string[];
  soft_warnings: string[];
  is_free_tier_preview?: boolean;
  preview_verdict_label?: string;
  upgrade_required_for_full_validation?: boolean;
}

export interface ValidationPathPayload {
  pathType: "current" | "adjusted" | "alternative";
  title: string;
  summary: string;
  rationale: string;
  modifications: string[];
  probabilityOfSuccess: number;
  disabled: boolean;
  disabledReason?: string;
}

export interface RuleEvaluationContext {
  scores: DimensionScores;
  thresholds: TierThresholds;
  archetype_id: string;
  archetype_minimum_demand_class: number;
  missing_critical_fields: boolean;
  framework_hard_veto: boolean;
  resource_goal_mismatch: boolean;
  matrix_tier: MatrixTier;
}
