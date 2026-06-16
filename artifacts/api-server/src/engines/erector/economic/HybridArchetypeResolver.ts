import type { ClassificationResult, ClassificationSignals, HybridResolution } from "./types.js";
import { extractClassificationSignals } from "./signalExtraction.js";
import type { ProfileInput } from "./types.js";

const ARCHETYPE_RISKS: Record<string, string> = {
  saas_platform: "retention_and_activation",
  subscription_membership: "churn",
  physical_product_inventory: "inventory_and_cash_flow",
  marketplace_exchange: "liquidity_and_matching",
  social_enterprise_mission: "funding_sustainability",
  collective_community: "engagement_decay",
  information_knowledge_product: "completion_and_refund",
  content_media: "distribution_dependency",
  direct_service_delivery: "capacity_ceiling",
  consulting_advisory: "pipeline_volatility",
};

function pickSecondary(
  primary: string,
  signals: ClassificationSignals,
  candidates: string[],
): string | null {
  const others = candidates.filter((a) => a !== primary);
  if (others.length === 0) {
    if (primary === "collective_community" && signals.education_overlay) {
      return "information_knowledge_product";
    }
    if (primary === "collective_community" && signals.value_delivery === "information") {
      return "information_knowledge_product";
    }
    if (primary === "information_knowledge_product" && signals.distribution_channel === "community") {
      return "collective_community";
    }
    if (primary === "saas_platform" && signals.value_delivery === "service") {
      return "consulting_advisory";
    }
    return null;
  }
  return others[0] ?? null;
}

export function resolveHybridArchetype(
  profile: ProfileInput,
  classification: ClassificationResult,
): HybridResolution {
  const signals = extractClassificationSignals(profile);
  const is_hybrid = classification.classification_confidence < 0.85;

  if (!is_hybrid) {
    const risk = ARCHETYPE_RISKS[classification.primary_archetype] ?? "general_execution";
    return {
      is_hybrid: false,
      secondary_archetype: null,
      tertiary_modifier: null,
      revenue_modifier: signals.revenue_model,
      delivery_modifier: signals.value_delivery,
      dominant_risk: risk,
      secondary_risk: null,
      simulation_priority: classification.primary_archetype,
      explanation: `Single archetype ${classification.primary_archetype} at ${classification.classification_confidence.toFixed(2)} confidence.`,
    };
  }

  const candidateArchetypes: string[] = [];
  if (signals.value_delivery === "community") candidateArchetypes.push("collective_community");
  if (signals.education_overlay || signals.value_delivery === "information") {
    candidateArchetypes.push("information_knowledge_product");
  }
  if (signals.value_delivery === "digital" && signals.revenue_model === "recurring") {
    candidateArchetypes.push("saas_platform");
  }
  if (signals.value_delivery === "service") candidateArchetypes.push("direct_service_delivery");
  if (signals.value_delivery === "physical") candidateArchetypes.push("physical_product_inventory");

  const secondary = pickSecondary(classification.primary_archetype, signals, candidateArchetypes);
  const dominant_risk = ARCHETYPE_RISKS[classification.primary_archetype] ?? "general_execution";
  const secondary_risk = secondary ? (ARCHETYPE_RISKS[secondary] ?? null) : null;

  let tertiary_modifier: string | null = null;
  if (signals.revenue_model === "recurring" && signals.fulfillment_model === "manual_recurring") {
    tertiary_modifier = "retainer_overlay";
  } else if (signals.transaction_type === "hybrid") {
    tertiary_modifier = "hybrid_pricing";
  }

  return {
    is_hybrid: true,
    secondary_archetype: secondary,
    tertiary_modifier,
    revenue_modifier: signals.revenue_model,
    delivery_modifier: signals.value_delivery,
    dominant_risk,
    secondary_risk,
    simulation_priority: secondary
      ? `${classification.primary_archetype}+${secondary}`
      : classification.primary_archetype,
    explanation: `Hybrid classification: primary ${classification.primary_archetype}${
      secondary ? ` with secondary ${secondary}` : ""
    } (confidence ${classification.classification_confidence.toFixed(2)}).`,
  };
}
