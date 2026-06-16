import type { InferSelectModel } from "drizzle-orm";
import type { erectorArchetypeRulePacks } from "@workspace/db";
import type { RealityProfileRow } from "../types/verdict-types.js";

export type ArchetypeRulePackRow = InferSelectModel<typeof erectorArchetypeRulePacks>;

export type ArchetypeRulePack = ArchetypeRulePackRow & {
  tier_adjustments_applied: Record<string, unknown>;
};

export type RevenueModelSignal =
  | "recurring"
  | "one-time"
  | "transaction_fee"
  | "donation"
  | "grants"
  | "unknown";
export type ValueDeliverySignal =
  | "digital"
  | "physical"
  | "service"
  | "information"
  | "community"
  | "platform";
export type CustomerTypeSignal =
  | "b2c"
  | "b2b"
  | "b2b2c"
  | "nonprofit_beneficiary"
  | "peer_to_peer";
export type TransactionTypeSignal =
  | "subscription"
  | "purchase"
  | "matching"
  | "licensing"
  | "advertising"
  | "hybrid";
export type FulfillmentModelSignal = "automated" | "manual_per_unit" | "manual_recurring" | "hybrid";
export type CapitalRequirementSignal = "low" | "medium" | "high";
export type DistributionChannelSignal =
  | "direct"
  | "platform"
  | "marketplace"
  | "community"
  | "content";
export type RetentionDependencySignal = "high" | "medium" | "low" | "none";
export type InventoryDependencySignal = "none" | "light" | "heavy";

export interface ClassificationSignals {
  revenue_model: RevenueModelSignal;
  value_delivery: ValueDeliverySignal;
  customer_type: CustomerTypeSignal;
  transaction_type: TransactionTypeSignal;
  fulfillment_model: FulfillmentModelSignal;
  capital_requirement: CapitalRequirementSignal;
  distribution_channel: DistributionChannelSignal;
  retention_dependency: RetentionDependencySignal;
  inventory_dependency: InventoryDependencySignal;
  education_overlay: boolean;
}

export interface ClassificationResult {
  primary_archetype: string;
  classification_confidence: number;
  classification_reason: string;
  signals_used: Record<string, string>;
}

export interface HybridResolution {
  is_hybrid: boolean;
  secondary_archetype: string | null;
  tertiary_modifier: string | null;
  revenue_modifier: string | null;
  delivery_modifier: string | null;
  dominant_risk: string;
  secondary_risk: string | null;
  simulation_priority: string;
  explanation: string;
}

export interface UnitEconomics {
  price_per_unit: number | null;
  estimated_monthly_revenue_ceiling: number | null;
  estimated_monthly_cost: number | null;
  gross_margin_estimate: number | null;
  capacity_limit_per_month: number | null;
  break_even_units: number | null;
  break_even_months: number | null;
  inventory_exposure: boolean;
  liquidity_requirement: "low" | "medium" | "high";
  sustainability_score: number;
}

export type ProfileInput = RealityProfileRow;
