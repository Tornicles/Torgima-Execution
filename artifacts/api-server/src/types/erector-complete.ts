/** TORGIMA_ERECTOR_COMPLETE_SYSTEM — 20-stage validation types */

export type ExecutionPathKey = "foundation" | "momentum" | "overdrive";

export type RefinementStatus = "pending" | "goal_refined" | "purpose_refined" | "complete";

export interface ValidationFeedInput {
  blueprintId: string;
  userId: string;
  idempotencyKey: string;
  goal_final: string;
  purpose_final: string;
  timeframe_start?: string;
  timeframe_end?: string;
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
  tier?: "starter" | "growth" | "ultimate";
}

export type StageName =
  | "stage_2_decomposition"
  | "stage_3_economic"
  | "stage_4_patterns"
  | "stage_5_timing"
  | "stage_6_market"
  | "stage_7_channels"
  | "stage_8_pros"
  | "stage_9_cons"
  | "stage_10_feasibility"
  | "stage_11_viability"
  | "stage_12_bootstrap"
  | "stage_13_features"
  | "stage_14_customer"
  | "stage_15_positioning"
  | "stage_16_difficulty"
  | "stage_17_revenue"
  | "stage_18_90days"
  | "stage_19_paths"
  | "stage_20_decision";

export interface HandoffPackage {
  goal_final: string;
  purpose_final: string;
  country: string;
  economic_type: string;
  business_type: string;
  timeframe_start?: string;
  timeframe_end?: string;
  target_customer: string;
  final_decision: string;
  selected_path: ExecutionPathKey;
  bootstrap_summary: Record<string, unknown>;
  feature_priority: Record<string, unknown>;
  first_90_days: Record<string, unknown>;
  positioning: Record<string, unknown>;
  revenue_path: Record<string, unknown>;
  risks: unknown[];
  opportunities: unknown[];
  customer_definition: Record<string, unknown>;
}
