/** Erector Goal + Purpose Refinement — types per refinement spec. */

export interface GoalUnderstanding {
  object: string;
  domain: string;
  impliedUser: string;
  impliedOutcome: string;
  unclear: string[];
}

export interface PurposeUnderstanding {
  problem: string;
  targetUser: string;
  change: string;
  value: string;
  missing?: string[];
}

export interface RefinementPackage {
  raw_goal: string;
  goal_options: string[];
  goal_understanding?: GoalUnderstanding;
  selected_goal_option?: number;
  goal_final?: string;
  raw_purpose?: string;
  purpose_options?: string[];
  purpose_understanding?: PurposeUnderstanding;
  selected_purpose_option?: number;
  purpose_final?: string;
  refinement_locked?: boolean;
}

export interface ValidationFeedInput {
  goal_final: string;
  purpose_final: string;
  timeframe?: {
    start?: string;
    end?: string;
    duration_days?: number;
  };
  country: string;
  economic_type?: string;
  business_type: string;
  business_model: string;
  commitment_level: string;
  budget: number;
  resources: string[];
  target_customer: string;
  currency?: string;
  location_city?: string;
}

export type ValidationSectionId =
  | "intake_confirmation"
  | "purpose_decomposition"
  | "economic_type"
  | "business_patterns"
  | "economy_timing"
  | "market_analysis"
  | "social_channels"
  | "pros"
  | "cons"
  | "feasibility"
  | "viability"
  | "bootstrap_summary"
  | "feature_recommendation"
  | "customer_definition"
  | "positioning"
  | "difficulty_breakdown"
  | "revenue_path"
  | "first_90_days"
  | "execution_paths"
  | "final_decision";

export interface ValidationSectionCard {
  id: ValidationSectionId;
  title: string;
  sequenceStage: number;
  content: Record<string, unknown>;
  summary?: string;
  pendingChange?: boolean;
  userEdits?: string[];
  lastUpdatedAt?: string;
}

export interface ValidationWorkspaceState {
  version: number;
  sections: ValidationSectionCard[];
  finalized: boolean;
  originalSnapshot?: Record<string, unknown>;
  updatedSnapshot?: Record<string, unknown>;
}

export const ERECTOR_BUSINESS_TYPES = [
  "Mobile App",
  "SaaS",
  "Content",
  "Service",
  "Marketplace",
  "Education",
  "Fitness",
  "Ecommerce",
  "Agency",
  "Community",
  "Physical Product",
  "Other",
] as const;
