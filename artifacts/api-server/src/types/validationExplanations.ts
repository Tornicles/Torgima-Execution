export type ValidationExplanations = {
  reality_score?: string;
  final_verdict?: string;
  at_a_glance?: {
    problem_exists?: string;
    market_demand?: string;
    competition_level?: string;
    execution_fit?: string;
    feasibility?: string;
    timing?: string;
  };
  market_trends?: string;
  competitors_overview?: string;
  pros_cons?: string;
  opportunities?: string;
  risks?: string;
  path_current?: string;
  path_adjusted?: string;
  path_alternative?: string;
  success_plan?: string;
};

export type CompetitorArchetype = "pioneer" | "fast_mover" | "indie_survivor";

export type DataConfidence = "verified" | "estimated" | "unavailable";

export type CompetitorDeepOutput = {
  name: string;
  archetype: CompetitorArchetype;
  description: string;
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  community_hub?: string | null;
  market_share_pct?: number | null;
  market_share_label?: string | null;
  relevance_summary: string;
  differentiation_hint: string;
  strengths: string[];
  weaknesses: string[];
  revenue_lifecycle: {
    year1_reality?: string | null;
    inflection_point?: string | null;
    current_scale?: string | null;
    data_confidence: DataConfidence;
    sources?: string[];
  };
  marketing_strategy: {
    primary_channel?: string;
    positioning_angle?: string;
    conversion_mechanism?: string;
    data_confidence: DataConfidence;
  };
  growth_catalyst: {
    distribution_hook?: string;
    retention_mechanics?: string;
    scale_trigger?: string;
    data_confidence: DataConfidence;
  };
  first_product_origin: {
    mvp_description?: string;
    day1_validation_method?: string;
    adjustment_history?: string[];
    time_to_first_revenue?: string | null;
    data_confidence: DataConfidence;
  };
  source_urls?: string[];
};
