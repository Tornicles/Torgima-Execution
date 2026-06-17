import type { IntakeTier, NormalizedIntake, RawIntakeInput } from "./types.js";

function readSection(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(section: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = section[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (["yes", "true", "y", "1"].includes(lower)) return true;
    if (["no", "false", "n", "0", "none"].includes(lower)) return false;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeBudgetUsd(budgetRange: string | null): number | null {
  if (!budgetRange) return null;
  const text = budgetRange.toLowerCase().replace(/\s+/g, " ").trim();
  if (text.includes("under") && text.includes("100")) return 50;
  if (text.includes("100") && text.includes("500")) return 300;
  if (text.includes("500") && text.includes("1,000")) return 750;
  if (text.includes("500") && text.includes("1000")) return 750;
  if (text.includes("1,000") && text.includes("5,000")) return 3000;
  if (text.includes("1000") && text.includes("5000")) return 3000;
  if (text.includes("5,000") || text.includes("5000+") || text.includes("over 5")) return 7500;
  const digits = text.match(/[\d,]+/g);
  if (digits?.length) {
    const nums = digits.map((d) => Number(d.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
    if (nums.length === 1) return nums[0]!;
    if (nums.length >= 2) return Math.round((nums[0]! + nums[1]!) / 2);
  }
  return null;
}

const INFORMAL_ECONOMY_REGIONS = [
  "nigeria",
  "kenya",
  "ghana",
  "india",
  "pakistan",
  "bangladesh",
  "philippines",
  "indonesia",
  "vietnam",
  "ethiopia",
  "tanzania",
  "uganda",
  "zimbabwe",
  "cameroon",
  "senegal",
];

const FORMAL_ENTITY_HINTS = [
  "llc",
  "inc",
  "corp",
  "limited",
  "plc",
  "gmbh",
  "registered",
  "incorporated",
  "company",
];

function inferOperatingContext(
  location: string | null,
  sections: Record<string, unknown>[],
): NormalizedIntake["operating_context"] {
  const blob = sections.map((s) => JSON.stringify(s).toLowerCase()).join(" ");
  const hasFormal = FORMAL_ENTITY_HINTS.some((h) => blob.includes(h));
  if (hasFormal) return "formal";

  const loc = (location ?? "").toLowerCase();
  const informalRegion = INFORMAL_ECONOMY_REGIONS.some((r) => loc.includes(r));
  if (informalRegion && !hasFormal) return "informal";
  if (informalRegion) return "hybrid";
  return hasFormal ? "formal" : null;
}

function inferPaymentInfrastructure(
  location: string | null,
  operatingContext: NormalizedIntake["operating_context"],
): NormalizedIntake["payment_infrastructure"] {
  const loc = (location ?? "").toLowerCase();
  if (operatingContext === "informal") {
    if (INFORMAL_ECONOMY_REGIONS.some((r) => loc.includes(r))) return "mobile_money";
    return "cash_primary";
  }
  if (operatingContext === "hybrid") return "mixed";
  if (["usa", "united states", "uk", "canada", "europe", "australia"].some((r) => loc.includes(r))) {
    return "digital_full";
  }
  if (INFORMAL_ECONOMY_REGIONS.some((r) => loc.includes(r))) return "mobile_money";
  return "mixed";
}

function inferMarketMaturity(location: string | null, industry: string | null): NormalizedIntake["market_maturity"] {
  const blob = `${location ?? ""} ${industry ?? ""}`.toLowerCase();
  if (blob.includes("ai ") || blob.includes("saas") || blob.includes("fintech")) return "saturated";
  if (blob.includes("crypto") || blob.includes("web3")) return "established";
  if (INFORMAL_ECONOMY_REGIONS.some((r) => blob.includes(r))) return "emerging";
  if (blob.includes("local") || blob.includes("niche")) return "developing";
  return "developing";
}

function inferInternetReliability(location: string | null): NormalizedIntake["internet_reliability"] {
  const loc = (location ?? "").toLowerCase();
  if (["usa", "united states", "uk", "canada", "germany", "france", "australia", "japan"].some((r) => loc.includes(r))) {
    return "high";
  }
  if (INFORMAL_ECONOMY_REGIONS.some((r) => loc.includes(r))) return "medium";
  return "medium";
}

function normalizeMarketScope(value: string | null): NormalizedIntake["market_scope"] {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("global") || lower.includes("world")) return "global";
  if (lower.includes("national") || lower.includes("country")) return "national";
  if (lower.includes("local") || lower.includes("city") || lower.includes("region")) return "local";
  return null;
}

function parsePriorAttempts(value: unknown): Array<{ what: string; why_failed: string }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          return {
            what: String(row.what ?? row.attempt ?? "").trim(),
            why_failed: String(row.why_failed ?? row.reason ?? "").trim(),
          };
        }
        return { what: String(item).trim(), why_failed: "" };
      })
      .filter((r) => r.what);
  }
  if (typeof value === "string" && value.trim()) {
    return [{ what: value.trim(), why_failed: "" }];
  }
  return [];
}

function normalizeFreeTier(input: RawIntakeInput): NormalizedIntake {
  const s1 = readSection(input.section_1_data);
  const industry = pickString(s1, "industry");
  const location = pickString(s1, "location");
  const budgetRange = pickString(s1, "budget_range", "budgetRange", "budget");
  const timeline = pickString(s1, "timeline", "timeline_launch", "launchDate");
  const additionalContext = pickString(s1, "additional_context", "additionalContext");
  const operatingContext = inferOperatingContext(location, [s1]);

  return {
    project_name: null,
    what_building: null,
    why_it_matters: null,
    desired_outcome: additionalContext,
    target_who: null,
    problem_solved: null,
    problem_urgency: null,
    paying_for_alternatives: null,
    location,
    market_scope: null,
    competitors: null,
    differentiation: null,
    operating_context: operatingContext,
    revenue_model: null,
    price_range: null,
    revenue_type: null,
    budget_range: budgetRange,
    budget_usd_estimate: normalizeBudgetUsd(budgetRange),
    hours_per_week: null,
    team_size: 1,
    skills_present: [],
    skills_missing: [],
    timeline_launch: timeline,
    timeline_customers: null,
    timeline_final: null,
    known_blockers: [],
    regulatory_flags: [],
    prior_attempts: [],
    success_30_days: null,
    success_90_days: null,
    success_12_months: null,
    payment_infrastructure: inferPaymentInfrastructure(location, operatingContext),
    market_maturity: inferMarketMaturity(location, industry),
    internet_reliability: inferInternetReliability(location),
    industry,
    additional_context: additionalContext,
  };
}

function normalizeFullIntake(input: RawIntakeInput): NormalizedIntake {
  const s1 = readSection(input.section_1_data);
  const s2 = readSection(input.section_2_data);
  const s3 = readSection(input.section_3_data);
  const s4 = readSection(input.section_4_data);
  const s5 = readSection(input.section_5_data);
  const s6 = readSection(input.section_6_data);
  const s7 = readSection(input.section_7_data);
  const s8 = readSection(input.section_8_data);
  const _s9 = readSection(input.section_9_data);

  const location = pickString(s3, "location");
  const industry =
    pickString(s3, "industry") ??
    pickString(s1, "industry") ??
    pickString(s4, "modelType", "model_type", "revenue_type");
  const budgetRange = pickString(s5, "budget", "budget_range", "budgetRange");
  const operatingContext = inferOperatingContext(location, [s1, s3, s4, s5, s7]);

  const regulatoryFlags = [
    pickString(s7, "legalBarriers", "legal_barriers"),
    pickString(s7, "technicalBarriers", "technical_barriers"),
    pickString(s7, "financialBarriers", "financial_barriers"),
  ].filter((v): v is string => Boolean(v));

  const knownBlockers = splitList(pickString(s7, "blockers", "known_blockers") ?? undefined);

  return {
    project_name: pickString(s1, "projectName", "project_name"),
    what_building: pickString(s1, "whatBuilding", "what_building"),
    why_it_matters: pickString(s1, "whyItMatters", "why_it_matters"),
    desired_outcome: pickString(s1, "desiredOutcome", "desired_outcome"),
    target_who: pickString(s2, "who", "target_who"),
    problem_solved: pickString(s2, "problem", "problem_solved"),
    problem_urgency: pickString(s2, "urgency", "problem_urgency"),
    paying_for_alternatives: parseBoolean(
      s2.payingForAlternatives ?? s2.paying_for_alternatives,
    ),
    location,
    market_scope: normalizeMarketScope(pickString(s3, "scope", "market_scope")),
    competitors: splitList(pickString(s3, "competitors") ?? undefined),
    differentiation: pickString(s3, "differentiation"),
    operating_context: operatingContext,
    revenue_model: pickString(s4, "revenueModel", "revenue_model"),
    price_range: pickString(s4, "priceRange", "price_range"),
    revenue_type: pickString(s4, "modelType", "revenue_type", "business_type"),
    budget_range: budgetRange,
    budget_usd_estimate: normalizeBudgetUsd(budgetRange),
    hours_per_week: parseNumber(s5.hoursPerWeek ?? s5.hours_per_week),
    team_size: parseNumber(s5.teamSize ?? s5.team_size) ?? 1,
    skills_present: splitList(s5.skillsPresent ?? s5.skills_present),
    skills_missing: splitList(s5.skillsMissing ?? s5.skills_missing),
    timeline_launch: pickString(s6, "launchDate", "timeline_launch", "launch_date"),
    timeline_customers: pickString(s6, "firstCustomersDate", "timeline_customers", "first_customers_date"),
    timeline_final: pickString(s6, "finalTargetDate", "timeline_final", "final_target_date"),
    known_blockers: knownBlockers,
    regulatory_flags: regulatoryFlags,
    prior_attempts: parsePriorAttempts(s7.priorAttempts ?? s7.prior_attempts),
    success_30_days: pickString(s8, "success30Days", "success_30_days"),
    success_90_days: pickString(s8, "success90Days", "success_90_days"),
    success_12_months: pickString(s8, "success12Months", "success_12_months"),
    payment_infrastructure: inferPaymentInfrastructure(location, operatingContext),
    market_maturity: inferMarketMaturity(location, industry ?? pickString(s4, "modelType", "model_type")),
    internet_reliability: inferInternetReliability(location),
    industry,
    additional_context: null,
  };
}

export function normalizeIntake(input: RawIntakeInput): NormalizedIntake {
  if (input.tier === "free") return normalizeFreeTier(input);
  return normalizeFullIntake(input);
}

export {
  buildSection1FromHandoff,
  buildSection3FromHandoff,
  buildSection5FromHandoff,
  buildHandoffSectionPayload,
  handoffFreeFieldsFromPayload,
  HANDOFF_PREFILLED_SECTIONS,
  nextUnfilledIntakeSection,
} from "./HandoffSectionPrefill.js";

export function rawIntakeFromSession(
  sessionId: string,
  tier: string,
  sections: {
    section_1_data: unknown;
    section_2_data: unknown;
    section_3_data: unknown;
    section_4_data: unknown;
    section_5_data: unknown;
    section_6_data: unknown;
    section_7_data: unknown;
    section_8_data: unknown;
    section_9_data?: unknown;
  },
): RawIntakeInput {
  const intakeTier: IntakeTier =
    tier === "free" || tier === "pro" || tier === "authenticated" ? tier : "authenticated";

  return {
    session_id: sessionId,
    tier: intakeTier,
    section_1_data: readSection(sections.section_1_data),
    section_2_data: readSection(sections.section_2_data),
    section_3_data: readSection(sections.section_3_data),
    section_4_data: readSection(sections.section_4_data),
    section_5_data: readSection(sections.section_5_data),
    section_6_data: readSection(sections.section_6_data),
    section_7_data: readSection(sections.section_7_data),
    section_8_data: readSection(sections.section_8_data),
    section_9_data: readSection(sections.section_9_data),
  };
}
