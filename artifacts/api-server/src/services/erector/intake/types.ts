export type IntakeTier = "free" | "pro" | "authenticated";

export interface RawIntakeInput {
  session_id: string;
  tier: IntakeTier;
  section_1_data: Record<string, unknown>;
  section_2_data: Record<string, unknown>;
  section_3_data: Record<string, unknown>;
  section_4_data: Record<string, unknown>;
  section_5_data: Record<string, unknown>;
  section_6_data: Record<string, unknown>;
  section_7_data: Record<string, unknown>;
  section_8_data: Record<string, unknown>;
}

export type MarketScope = "local" | "national" | "global";
export type OperatingContext = "formal" | "informal" | "hybrid";
export type PaymentInfrastructure = "digital_full" | "mobile_money" | "cash_primary" | "mixed";
export type MarketMaturity = "emerging" | "developing" | "established" | "saturated";
export type InternetReliability = "high" | "medium" | "low";

export interface NormalizedIntake {
  project_name: string | null;
  what_building: string | null;
  why_it_matters: string | null;
  desired_outcome: string | null;
  target_who: string | null;
  problem_solved: string | null;
  problem_urgency: string | null;
  paying_for_alternatives: boolean | null;
  location: string | null;
  market_scope: MarketScope | null;
  competitors: string[] | null;
  differentiation: string | null;
  operating_context: OperatingContext | null;
  revenue_model: string | null;
  price_range: string | null;
  revenue_type: string | null;
  budget_range: string | null;
  budget_usd_estimate: number | null;
  hours_per_week: number | null;
  team_size: number;
  skills_present: string[];
  skills_missing: string[];
  timeline_launch: string | null;
  timeline_customers: string | null;
  timeline_final: string | null;
  known_blockers: string[];
  regulatory_flags: string[];
  prior_attempts: Array<{ what: string; why_failed: string }>;
  success_30_days: string | null;
  success_90_days: string | null;
  success_12_months: string | null;
  payment_infrastructure: PaymentInfrastructure;
  market_maturity: MarketMaturity;
  internet_reliability: InternetReliability;
  /** Free-tier only */
  industry: string | null;
  additional_context: string | null;
}

export type MissingFieldPriority = "critical" | "high" | "recommended";

export interface MissingFieldResult {
  has_missing_required: boolean;
  missing_fields: Array<{
    field: string;
    customer_label: string;
    question_to_ask: string;
    priority: MissingFieldPriority;
  }>;
}

export type AmbiguityIssue = "too_vague" | "unmeasurable" | "no_specificity" | "too_broad" | "undefined";

export interface AmbiguityResult {
  has_ambiguity: boolean;
  ambiguity_flags: Array<{
    field: string;
    detected_issue: AmbiguityIssue;
    customer_question: string;
    severity: "blocking" | "reduces_score";
  }>;
}

export interface ContradictionResult {
  has_contradictions: boolean;
  contradiction_score: number;
  contradictions: Array<{
    type: string;
    field_a: string;
    field_b: string;
    description: string;
    severity: "HARD_BLOCKER" | "SOFT_BLOCKER";
    verdict_effect: "PIVOT" | "ADJUST";
    customer_explanation: string;
  }>;
}

export interface IntakePipelineResult {
  profile_id: string;
  validation_ready: boolean;
  missing_fields: MissingFieldResult["missing_fields"];
  ambiguity_flags: AmbiguityResult["ambiguity_flags"];
  contradiction_score: number;
}
