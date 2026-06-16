import type { IntakeTier, MissingFieldResult, NormalizedIntake } from "./types.js";

type FieldSpec = {
  field: keyof NormalizedIntake | "industry";
  customer_label: string;
  question_to_ask: string;
  priority: "critical" | "high" | "recommended";
  tiers: IntakeTier[];
};

const FIELD_SPECS: FieldSpec[] = [
  {
    field: "industry",
    customer_label: "Industry",
    question_to_ask: "What industry or category does your idea belong to?",
    priority: "critical",
    tiers: ["free", "pro", "authenticated"],
  },
  {
    field: "location",
    customer_label: "Market location",
    question_to_ask: "Where will you operate or sell first?",
    priority: "critical",
    tiers: ["free", "pro", "authenticated"],
  },
  {
    field: "budget_range",
    customer_label: "Available budget",
    question_to_ask: "What budget can you realistically invest in the next 90 days?",
    priority: "critical",
    tiers: ["free", "pro", "authenticated"],
  },
  {
    field: "timeline_launch",
    customer_label: "Launch timeline",
    question_to_ask: "When do you plan to launch or ship a first version?",
    priority: "critical",
    tiers: ["free", "pro", "authenticated"],
  },
  {
    field: "what_building",
    customer_label: "What you are building",
    question_to_ask: "Describe clearly what you are building and for whom.",
    priority: "critical",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "desired_outcome",
    customer_label: "Desired outcome",
    question_to_ask: "What specific outcome do you want from this launch?",
    priority: "critical",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "target_who",
    customer_label: "Target customer",
    question_to_ask: "Who exactly is your target customer?",
    priority: "critical",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "problem_solved",
    customer_label: "Problem solved",
    question_to_ask: "What problem are you solving for them?",
    priority: "high",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "revenue_model",
    customer_label: "Revenue model",
    question_to_ask: "How will this make money?",
    priority: "critical",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "hours_per_week",
    customer_label: "Weekly commitment",
    question_to_ask: "How many hours per week can you commit?",
    priority: "critical",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "success_30_days",
    customer_label: "30-day success definition",
    question_to_ask: "What measurable success do you want in the first 30 days?",
    priority: "critical",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "differentiation",
    customer_label: "Differentiation",
    question_to_ask: "How are you different from alternatives?",
    priority: "recommended",
    tiers: ["pro", "authenticated"],
  },
  {
    field: "competitors",
    customer_label: "Competitors",
    question_to_ask: "Who else solves this problem today?",
    priority: "recommended",
    tiers: ["pro", "authenticated"],
  },
];

function isPresent(normalized: NormalizedIntake, field: FieldSpec["field"]): boolean {
  if (field === "industry") return Boolean(normalized.industry?.trim());
  const value = normalized[field];
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function detectMissingFields(
  normalized: NormalizedIntake,
  tier: IntakeTier,
): MissingFieldResult {
  const missing_fields = FIELD_SPECS.filter((spec) => spec.tiers.includes(tier))
    .filter((spec) => !isPresent(normalized, spec.field))
    .map((spec) => ({
      field: spec.field,
      customer_label: spec.customer_label,
      question_to_ask: spec.question_to_ask,
      priority: spec.priority,
    }));

  return {
    has_missing_required: missing_fields.some((m) => m.priority === "critical"),
    missing_fields,
  };
}

export function hasCriticalMissingFields(result: MissingFieldResult): boolean {
  return result.missing_fields.some((m) => m.priority === "critical");
}
