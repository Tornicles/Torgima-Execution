import type { AmbiguityResult, NormalizedIntake } from "./types.js";

const VAGUE_TIMELINE = new Set(["asap", "soon", "quickly", "immediately", "right away", "this month"]);
const BROAD_AUDIENCE = new Set(["everyone", "anyone", "all people", "the world", "everybody"]);
const UNDEFINED_REVENUE = new Set([
  "not sure",
  "unsure",
  "don't know",
  "dont know",
  "tbd",
  "unknown",
  "undecided",
]);

function hasMeasurableElement(text: string | null): boolean {
  if (!text?.trim()) return false;
  if (/\d/.test(text)) return true;
  return /\b(users?|customers?|revenue|sales|signups?|subscribers?|mrr|arr|profit|leads?)\b/i.test(text);
}

function isEnterpriseScale(whatBuilding: string | null): boolean {
  if (!whatBuilding) return false;
  const lower = whatBuilding.toLowerCase();
  return /\b(saas|platform|marketplace|enterprise|b2b software|app store)\b/.test(lower);
}

export function detectAmbiguity(normalized: NormalizedIntake): AmbiguityResult {
  const ambiguity_flags: AmbiguityResult["ambiguity_flags"] = [];

  if (normalized.what_building && normalized.what_building.length < 20) {
    ambiguity_flags.push({
      field: "what_building",
      detected_issue: "too_vague",
      customer_question: "Can you describe what you are building in more specific terms?",
      severity: "blocking",
    });
  }

  if (normalized.desired_outcome && !hasMeasurableElement(normalized.desired_outcome)) {
    ambiguity_flags.push({
      field: "desired_outcome",
      detected_issue: "unmeasurable",
      customer_question: "What number or milestone would prove you reached your desired outcome?",
      severity: "reduces_score",
    });
  }

  const revenue = normalized.revenue_model?.toLowerCase().trim() ?? "";
  if (revenue && UNDEFINED_REVENUE.has(revenue)) {
    ambiguity_flags.push({
      field: "revenue_model",
      detected_issue: "undefined",
      customer_question: "How do you plan to charge or earn revenue from this idea?",
      severity: "blocking",
    });
  }

  const launch = normalized.timeline_launch?.toLowerCase().trim() ?? "";
  if (launch && VAGUE_TIMELINE.has(launch)) {
    ambiguity_flags.push({
      field: "timeline_launch",
      detected_issue: "unmeasurable",
      customer_question: "What exact date or week are you targeting for launch?",
      severity: "reduces_score",
    });
  }

  const target = normalized.target_who?.toLowerCase().trim() ?? "";
  if (target && BROAD_AUDIENCE.has(target)) {
    ambiguity_flags.push({
      field: "target_who",
      detected_issue: "too_broad",
      customer_question: "Who is the first specific customer segment you will serve?",
      severity: "blocking",
    });
  }

  for (const field of ["success_30_days", "success_90_days", "success_12_months"] as const) {
    const value = normalized[field];
    if (value && !hasMeasurableElement(value)) {
      ambiguity_flags.push({
        field,
        detected_issue: "unmeasurable",
        customer_question: `What measurable result would show ${field.replace(/_/g, " ")} was achieved?`,
        severity: "reduces_score",
      });
    }
  }

  if (isEnterpriseScale(normalized.what_building) && !normalized.revenue_model) {
    ambiguity_flags.push({
      field: "revenue_model",
      detected_issue: "no_specificity",
      customer_question: "How will this product generate recurring or scalable revenue?",
      severity: "blocking",
    });
  }

  return {
    has_ambiguity: ambiguity_flags.length > 0,
    ambiguity_flags,
  };
}
