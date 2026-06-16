import type { ClassificationSignals, ProfileInput } from "./types.js";

function blob(profile: ProfileInput): string {
  const purpose = profile.structured_purpose as Record<string, unknown>;
  return [
    profile.structured_goal,
    profile.goal_measurable_outcome,
    profile.revenue_model,
    profile.business_type,
    profile.industry,
    profile.price_range,
    purpose.target_who,
    purpose.differentiation,
    purpose.problem_solved,
    profile.payment_infrastructure,
    profile.operating_context,
    profile.market_scope,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t));
}

export function extractClassificationSignals(profile: ProfileInput): ClassificationSignals {
  const text = blob(profile);
  const purpose = profile.structured_purpose as Record<string, unknown>;
  const targetWho = String(purpose.target_who ?? "").toLowerCase();

  let revenue_model: ClassificationSignals["revenue_model"] = "unknown";
  if (includesAny(text, ["subscription", "recurring", "monthly", "mrr", "saas"])) revenue_model = "recurring";
  else if (includesAny(text, ["per project", "one-time", "per-project", "project fee"])) revenue_model = "one-time";
  else if (includesAny(text, ["transaction fee", "commission", "take rate", "marketplace fee"])) {
    revenue_model = "transaction_fee";
  } else if (includesAny(text, ["donation", "tip jar"])) revenue_model = "donation";
  else if (includesAny(text, ["grant", "nonprofit funding"])) revenue_model = "grants";

  const hasCommunity = includesAny(text, ["community", "membership community", "paid community"]);
  const education_overlay = includesAny(text, [
    "course",
    "ebook",
    "information",
    "educational",
    "knowledge",
  ]);

  let value_delivery: ClassificationSignals["value_delivery"] = "service";
  if (hasCommunity && education_overlay) value_delivery = "community";
  else if (includesAny(text, ["software", "saas", "app", "digital tool", "platform"])) {
    value_delivery = "digital";
  } else if (includesAny(text, ["physical", "inventory", "goods", "reseller", "whatsapp reseller"])) {
    value_delivery = "physical";
  } else if (education_overlay) value_delivery = "information";
  else if (hasCommunity) value_delivery = "community";
  else if (includesAny(text, ["marketplace", "two-sided", "matching platform"])) value_delivery = "platform";
  else if (includesAny(text, ["consult", "advisory", "coaching", "freelance", "design service"])) {
    value_delivery = "service";
  }

  let customer_type: ClassificationSignals["customer_type"] = "b2c";
  if (includesAny(text, ["nonprofit", "beneficiary", "mission-driven", "social enterprise"])) {
    customer_type = "nonprofit_beneficiary";
  } else if (includesAny(targetWho, ["enterprise", "b2b", "businesses", "teams", "companies"])) {
    customer_type = "b2b";
  } else if (includesAny(text, ["b2b2c", "partners"])) customer_type = "b2b2c";
  else if (includesAny(text, ["peer to peer", "p2p"])) customer_type = "peer_to_peer";

  let transaction_type: ClassificationSignals["transaction_type"] = "purchase";
  if (revenue_model === "recurring" || includesAny(text, ["subscription", "monthly fee"])) {
    transaction_type = "subscription";
  } else if (includesAny(text, ["matching", "marketplace match"])) transaction_type = "matching";
  else if (includesAny(text, ["license", "licensing"])) transaction_type = "licensing";
  else if (includesAny(text, ["ads", "advertising"])) transaction_type = "advertising";
  else if (includesAny(text, ["hybrid pricing"])) transaction_type = "hybrid";

  let fulfillment_model: ClassificationSignals["fulfillment_model"] = "manual_per_unit";
  if (includesAny(text, ["automated", "self-serve", "software delivery", "saas"])) {
    fulfillment_model = "automated";
  } else if (includesAny(text, ["ongoing service", "retainer", "monthly delivery"])) {
    fulfillment_model = "manual_recurring";
  } else if (includesAny(text, ["hybrid fulfillment"])) fulfillment_model = "hybrid";

  const budget = profile.budget_usd_estimate ?? 0;
  let capital_requirement: ClassificationSignals["capital_requirement"] = "low";
  if (budget >= 10_000) capital_requirement = "high";
  else if (budget >= 1_000) capital_requirement = "medium";

  let distribution_channel: ClassificationSignals["distribution_channel"] = "direct";
  if (value_delivery === "platform" || includesAny(text, ["app store", "platform distribution"])) {
    distribution_channel = "platform";
  } else if (includesAny(text, ["marketplace", "ebay", "amazon"])) distribution_channel = "marketplace";
  else if (value_delivery === "community") distribution_channel = "community";
  else if (includesAny(text, ["youtube", "newsletter", "content", "media", "podcast"])) {
    distribution_channel = "content";
  }

  let retention_dependency: ClassificationSignals["retention_dependency"] = "medium";
  if (revenue_model === "recurring" || includesAny(text, ["retention", "churn", "renewal"])) {
    retention_dependency = "high";
  } else if (revenue_model === "one-time") retention_dependency = "low";
  else if (includesAny(text, ["no retention", "one-off"])) retention_dependency = "none";

  let inventory_dependency: ClassificationSignals["inventory_dependency"] = "none";
  if (value_delivery === "physical" || includesAny(text, ["inventory", "stock", "reseller", "goods"])) {
    inventory_dependency = includesAny(text, ["heavy inventory", "warehouse"]) ? "heavy" : "heavy";
  } else if (includesAny(text, ["light inventory", "samples"])) inventory_dependency = "light";

  return {
    revenue_model,
    value_delivery,
    customer_type,
    transaction_type,
    fulfillment_model,
    capital_requirement,
    distribution_channel,
    retention_dependency,
    inventory_dependency,
    education_overlay,
  };
}
