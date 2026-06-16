import type { ClassificationResult, ClassificationSignals } from "./types.js";
import { extractClassificationSignals } from "./signalExtraction.js";
import type { ProfileInput } from "./types.js";

type Candidate = { archetype: string; confidence: number; reason: string };

function signalsRecord(signals: ClassificationSignals): Record<string, string> {
  return Object.fromEntries(
    Object.entries(signals).map(([key, value]) => [key, String(value)]),
  );
}

function scorePhysical(signals: ClassificationSignals): Candidate | null {
  if (signals.inventory_dependency === "heavy" || signals.value_delivery === "physical") {
    return {
      archetype: "physical_product_inventory",
      confidence: signals.inventory_dependency === "heavy" ? 0.92 : 0.88,
      reason: "Physical goods with inventory dependency",
    };
  }
  return null;
}

function scoreMarketplace(signals: ClassificationSignals): Candidate | null {
  if (
    signals.transaction_type === "matching" ||
    (signals.value_delivery === "platform" && signals.revenue_model === "transaction_fee")
  ) {
    return {
      archetype: "marketplace_exchange",
      confidence: 0.9,
      reason: "Matching or transaction-fee platform model",
    };
  }
  return null;
}

function scoreSaas(signals: ClassificationSignals): Candidate | null {
  if (
    signals.revenue_model === "recurring" &&
    signals.fulfillment_model === "automated" &&
    (signals.value_delivery === "digital" || signals.transaction_type === "subscription")
  ) {
    const isPureSaas =
      signals.value_delivery === "digital" && !signals.distribution_channel.includes("community");
    return {
      archetype: isPureSaas ? "saas_platform" : "subscription_membership",
      confidence: isPureSaas ? 0.9 : 0.82,
      reason: isPureSaas
        ? "Recurring automated digital delivery"
        : "Recurring membership without full SaaS automation",
    };
  }
  return null;
}

function scoreSocialEnterprise(signals: ClassificationSignals): Candidate | null {
  if (
    signals.customer_type === "nonprofit_beneficiary" ||
    signals.revenue_model === "donation" ||
    signals.revenue_model === "grants"
  ) {
    return {
      archetype: "social_enterprise_mission",
      confidence: 0.88,
      reason: "Mission-driven or nonprofit revenue model",
    };
  }
  return null;
}

function scoreCommunity(signals: ClassificationSignals): Candidate | null {
  if (
    signals.value_delivery === "community" ||
    (signals.distribution_channel === "community" && signals.retention_dependency === "high")
  ) {
    const confidence = signals.education_overlay ? 0.78 : 0.86;
    return {
      archetype: "collective_community",
      confidence,
      reason: signals.education_overlay
        ? "Community-led model with education overlay"
        : "Community-led value with retention dependency",
    };
  }
  return null;
}

function scoreInformation(signals: ClassificationSignals): Candidate | null {
  if (signals.value_delivery === "community" && signals.education_overlay) {
    return {
      archetype: "information_knowledge_product",
      confidence: 0.72,
      reason: "Education layer within community model",
    };
  }
  if (
    signals.value_delivery === "information" ||
    (signals.education_overlay && signals.value_delivery !== "community")
  ) {
    return {
      archetype: "information_knowledge_product",
      confidence: 0.8,
      reason: "Information or knowledge product delivery",
    };
  }
  return null;
}

function scoreContentMedia(signals: ClassificationSignals): Candidate | null {
  if (signals.distribution_channel === "content" && signals.value_delivery !== "information") {
    return {
      archetype: "content_media",
      confidence: 0.85,
      reason: "Content-led distribution model",
    };
  }
  return null;
}

function scoreDirectService(signals: ClassificationSignals): Candidate | null {
  if (
    signals.fulfillment_model === "manual_per_unit" &&
    signals.value_delivery === "service" &&
    (signals.customer_type === "b2b" || signals.customer_type === "b2c")
  ) {
    return {
      archetype: "direct_service_delivery",
      confidence: 0.87,
      reason: "Manual per-unit service delivery to end customers",
    };
  }
  return null;
}

function scoreConsulting(signals: ClassificationSignals): Candidate | null {
  if (
    signals.value_delivery === "service" &&
    signals.revenue_model === "one-time" &&
    signals.fulfillment_model !== "automated"
  ) {
    return {
      archetype: "consulting_advisory",
      confidence: 0.84,
      reason: "One-time advisory or consulting engagement",
    };
  }
  return null;
}

const SCORERS = [
  scorePhysical,
  scoreMarketplace,
  scoreSaas,
  scoreSocialEnterprise,
  scoreCommunity,
  scoreInformation,
  scoreContentMedia,
  scoreDirectService,
  scoreConsulting,
];

export function classifyEconomicTypeFromProfile(profile: ProfileInput): ClassificationResult {
  const signals = extractClassificationSignals(profile);
  const candidates: Candidate[] = [];

  for (const scorer of SCORERS) {
    const hit = scorer(signals);
    if (hit) candidates.push(hit);
  }

  if (candidates.length === 0) {
    return {
      primary_archetype: "direct_service_delivery",
      classification_confidence: 0.55,
      classification_reason: "Default fallback — insufficient distinctive signals",
      signals_used: signalsRecord(signals),
    };
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const primary = candidates[0]!;
  const runnerUp = candidates[1];

  let confidence = primary.confidence;
  if (runnerUp && runnerUp.confidence >= primary.confidence - 0.08) {
    confidence = Math.min(confidence, 0.78);
  }

  return {
    primary_archetype: primary.archetype,
    classification_confidence: confidence,
    classification_reason: primary.reason,
    signals_used: signalsRecord(signals),
  };
}
