import type { ContradictionResult, NormalizedIntake } from "./types.js";

function isSaasGoal(normalized: NormalizedIntake): boolean {
  const blob = `${normalized.what_building ?? ""} ${normalized.revenue_type ?? ""} ${normalized.revenue_model ?? ""}`.toLowerCase();
  return /\b(saas|subscription|software as a service|b2b software)\b/.test(blob);
}

function parseTimelineDays(value: string | null): number | null {
  if (!value?.trim()) return null;
  const lower = value.toLowerCase();
  if (/\b(\d+)\s*day/.test(lower)) {
    const match = lower.match(/\b(\d+)\s*day/);
    return match ? Number(match[1]) : null;
  }
  if (/\b(\d+)\s*week/.test(lower)) {
    const match = lower.match(/\b(\d+)\s*week/);
    return match ? Number(match[1]) * 7 : null;
  }
  if (/\b(\d+)\s*month/.test(lower)) {
    const match = lower.match(/\b(\d+)\s*month/);
    return match ? Number(match[1]) * 30 : null;
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    const diffMs = parsed - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  if (lower.includes("30 day") || lower.includes("30-day")) return 30;
  if (lower.includes("90 day") || lower.includes("90-day")) return 90;
  return null;
}

function requiresDigitalPayments(normalized: NormalizedIntake): boolean {
  const blob = `${normalized.revenue_model ?? ""} ${normalized.revenue_type ?? ""}`.toLowerCase();
  return /\b(saas|subscription|stripe|online payment|recurring|ecommerce|e-commerce)\b/.test(blob);
}

function impliesFullTimeWork(success30: string | null): boolean {
  if (!success30) return false;
  const lower = success30.toLowerCase();
  return /\b(full[- ]time|launch live|100 customers|50 customers|revenue|profit|mrr|arr)\b/.test(lower);
}

function scoreContradictions(
  contradictions: ContradictionResult["contradictions"],
): number {
  let score = 0;
  for (const c of contradictions) {
    score += c.severity === "HARD_BLOCKER" ? 30 : 12;
    if (c.verdict_effect === "PIVOT") score += 8;
  }
  return Math.min(100, score);
}

export function detectContradictions(normalized: NormalizedIntake): ContradictionResult {
  const contradictions: ContradictionResult["contradictions"] = [];

  const launchDays = parseTimelineDays(normalized.timeline_launch);
  const enterprise = /\b(platform|marketplace|enterprise|saas)\b/i.test(normalized.what_building ?? "");
  const hours = normalized.hours_per_week ?? 0;

  if (enterprise && launchDays !== null && launchDays < 90 && hours < 10) {
    const timelineFixable = hours >= 5;
    contradictions.push({
      type: "RESOURCE_TIMELINE_MISMATCH",
      field_a: "what_building",
      field_b: "timeline_launch",
      description: "Enterprise-scale goal with very short timeline and limited weekly hours.",
      severity: timelineFixable ? "SOFT_BLOCKER" : "HARD_BLOCKER",
      verdict_effect: timelineFixable ? "ADJUST" : "PIVOT",
      customer_explanation:
        "Your goal looks enterprise-scale, but your timeline and weekly hours do not support that scope.",
    });
  }

  const budget = normalized.budget_usd_estimate ?? 0;
  if (isSaasGoal(normalized) && budget < 1000 && normalized.team_size <= 1) {
    contradictions.push({
      type: "BUDGET_ARCHETYPE_MISMATCH",
      field_a: "what_building",
      field_b: "budget_range",
      description: "SaaS-style goal with very low budget and solo team.",
      severity: "SOFT_BLOCKER",
      verdict_effect: "ADJUST",
      customer_explanation: "A SaaS product usually needs more budget or team capacity than currently stated.",
    });
  }

  if (
    normalized.market_scope === "global" &&
    budget < 500 &&
    normalized.team_size <= 1
  ) {
    contradictions.push({
      type: "MARKET_SCOPE_RESOURCE_MISMATCH",
      field_a: "market_scope",
      field_b: "budget_range",
      description: "Global market ambition with minimal budget and solo operator.",
      severity: "SOFT_BLOCKER",
      verdict_effect: "ADJUST",
      customer_explanation: "A global launch typically needs more budget or a narrower initial market.",
    });
  }

  if (normalized.what_building && !normalized.revenue_model) {
    contradictions.push({
      type: "NO_REVENUE_MODEL_WITH_PRODUCT",
      field_a: "what_building",
      field_b: "revenue_model",
      description: "Product described without a revenue model.",
      severity: "SOFT_BLOCKER",
      verdict_effect: "ADJUST",
      customer_explanation: "You described a product but not how it will make money.",
    });
  }

  if (
    normalized.operating_context === "informal" &&
    requiresDigitalPayments(normalized) &&
    normalized.payment_infrastructure !== "digital_full"
  ) {
    contradictions.push({
      type: "INFORMAL_ECONOMY_FORMAL_PRODUCT_MISMATCH",
      field_a: "operating_context",
      field_b: "revenue_model",
      description: "Revenue model depends on payment rails not typical in informal operating context.",
      severity: "SOFT_BLOCKER",
      verdict_effect: "ADJUST",
      customer_explanation:
        "Your revenue model may need to adapt to the payment infrastructure available in your market.",
    });
  }

  if (impliesFullTimeWork(normalized.success_30_days) && hours > 0 && hours < 5) {
    contradictions.push({
      type: "CAPACITY_OVERCOMMITMENT",
      field_a: "success_30_days",
      field_b: "hours_per_week",
      description: "30-day success definition implies more capacity than weekly hours allow.",
      severity: "SOFT_BLOCKER",
      verdict_effect: "ADJUST",
      customer_explanation: "Your 30-day success goal may be too ambitious for the hours you can commit.",
    });
  }

  const contradiction_score = scoreContradictions(contradictions);

  return {
    has_contradictions: contradictions.length > 0,
    contradiction_score,
    contradictions,
  };
}
