/** Payload inside Bhudhi envelope `data` for REALITY_INTELLIGENCE (canonical v2). */
export interface RealityIntelligenceData {
  marketMomentum: "growing" | "declining" | "emerging" | "oversaturated" | "behavior_shifting";
  demandConfidence: "high" | "medium" | "low";
  trendExplanation: string;
  similarConcepts: Array<{
    name: string;
    reason: string;
    outcome: "succeeded" | "failed" | "pivoted";
    lesson: string;
    differentiationInsight: string;
  }>;
  positioning: {
    strongestAngle: string;
    weakestAngle: string;
    userMisconception: string;
    differentiationPath: string;
    positioningRule: string;
  };
  whiteSpace: {
    underservedUsers: string[];
    emotionalGaps: string[];
    executionGaps: string[];
    competitorWeaknesses: string[];
    unclaimedPositioning: string[];
    opportunityPath: string;
  };
  timingAnalysis: {
    risk: string;
    opportunity: string;
    urgency: "immediate" | "moderate" | "patient";
    reason: string;
  };
  strategicWarnings: string[];
  blueprintSeedInstructions: string;
  executionImplication: string;
}

const MOMENTUM = new Set([
  "growing",
  "declining",
  "emerging",
  "oversaturated",
  "behavior_shifting",
]);

const CONF = new Set(["high", "medium", "low"]);

const URG = new Set(["immediate", "moderate", "patient"]);

const OUTCOME = new Set(["succeeded", "failed", "pivoted"]);

/**
 * Normalizes legacy caches (v1 `similarCompanies`, `differentiationOpportunity`, top-level `competitorWeaknesses`).
 */
export function normalizeRealityIntelligenceData(raw: unknown): RealityIntelligenceData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const mmRaw = String(r["marketMomentum"] ?? "growing");
  const marketMomentum = (MOMENTUM.has(mmRaw) ? mmRaw : "growing") as RealityIntelligenceData["marketMomentum"];

  const dcRaw = String(r["demandConfidence"] ?? "medium").toLowerCase();
  const demandConfidence = (
    CONF.has(dcRaw) ? dcRaw : "medium"
  ) as RealityIntelligenceData["demandConfidence"];

  const trendExplanation =
    typeof r["trendExplanation"] === "string" && r["trendExplanation"]
      ? String(r["trendExplanation"])
      : "Category read is inferred from your goal and domain — treat as strategic framing, not live market data.";

  let similarConcepts: RealityIntelligenceData["similarConcepts"];
  if (Array.isArray(r["similarConcepts"])) {
    similarConcepts = (r["similarConcepts"] as Record<string, unknown>[]).map((c) => ({
      name: String(c["name"] ?? ""),
      reason: String(c["reason"] ?? ""),
      outcome: (OUTCOME.has(String(c["outcome"])) ? String(c["outcome"]) : "pivoted") as
        | "succeeded"
        | "failed"
        | "pivoted",
      lesson: String(c["lesson"] ?? ""),
      differentiationInsight: String(c["differentiationInsight"] ?? ""),
    }));
  } else if (Array.isArray(r["similarCompanies"])) {
    similarConcepts = (r["similarCompanies"] as Record<string, unknown>[]).map((c) => ({
      name: String(c["name"] ?? ""),
      reason: String(c["reason"] ?? ""),
      outcome: (OUTCOME.has(String(c["outcome"])) ? String(c["outcome"]) : "pivoted") as
        | "succeeded"
        | "failed"
        | "pivoted",
      lesson: String(c["lesson"] ?? ""),
      differentiationInsight: "",
    }));
  } else {
    similarConcepts = [];
  }

  const pos = (r["positioning"] ?? {}) as Record<string, unknown>;
  const positioning: RealityIntelligenceData["positioning"] = {
    strongestAngle: String(pos["strongestAngle"] ?? ""),
    weakestAngle: String(pos["weakestAngle"] ?? ""),
    userMisconception: String(pos["userMisconception"] ?? ""),
    differentiationPath: String(
      pos["differentiationPath"] ?? pos["differentiationOpportunity"] ?? "",
    ),
    positioningRule: String(pos["positioningRule"] ?? ""),
  };

  const ws = (r["whiteSpace"] ?? {}) as Record<string, unknown>;
  const legacyWeak = Array.isArray(r["competitorWeaknesses"])
    ? (r["competitorWeaknesses"] as unknown[]).map((x) => String(x))
    : [];
  const wsWeak = Array.isArray(ws["competitorWeaknesses"])
    ? (ws["competitorWeaknesses"] as unknown[]).map((x) => String(x))
    : [];
  const competitorWeaknesses = wsWeak.length ? wsWeak : legacyWeak;

  const whiteSpace: RealityIntelligenceData["whiteSpace"] = {
    underservedUsers: Array.isArray(ws["underservedUsers"])
      ? (ws["underservedUsers"] as unknown[]).map(String)
      : [],
    emotionalGaps: Array.isArray(ws["emotionalGaps"])
      ? (ws["emotionalGaps"] as unknown[]).map(String)
      : [],
    executionGaps: Array.isArray(ws["executionGaps"]) ? (ws["executionGaps"] as unknown[]).map(String) : [],
    competitorWeaknesses,
    unclaimedPositioning: Array.isArray(ws["unclaimedPositioning"])
      ? (ws["unclaimedPositioning"] as unknown[]).map(String)
      : [],
    opportunityPath: String(ws["opportunityPath"] ?? ""),
  };

  const ta = (r["timingAnalysis"] ?? {}) as Record<string, unknown>;
  const ur = String(ta["urgency"] ?? "moderate").toLowerCase();
  const timingAnalysis: RealityIntelligenceData["timingAnalysis"] = {
    risk: String(ta["risk"] ?? ""),
    opportunity: String(ta["opportunity"] ?? ""),
    urgency: (URG.has(ur) ? ur : "moderate") as RealityIntelligenceData["timingAnalysis"]["urgency"],
    reason: String(ta["reason"] ?? ""),
  };

  const strategicWarnings = Array.isArray(r["strategicWarnings"]) ? (r["strategicWarnings"] as unknown[]).map(String) : [];

  const blueprintSeedInstructions = String(r["blueprintSeedInstructions"] ?? r["blueprintSeedingInstructions"] ?? "");

  const executionImplication = String(r["executionImplication"] ?? "");

  return {
    marketMomentum,
    demandConfidence,
    trendExplanation,
    similarConcepts,
    positioning,
    whiteSpace,
    timingAnalysis,
    strategicWarnings,
    blueprintSeedInstructions,
    executionImplication,
  };
}
