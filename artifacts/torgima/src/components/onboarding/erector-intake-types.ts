export type TimeframeKey = "30d" | "90d" | "6m" | "1yr" | "custom";
export type CommitmentKey = "LOW" | "MEDIUM" | "HIGH" | "INTENSE";

export type ErectorIntakeForm = {
  primaryGoal: string;
  purpose: string;
  timeframeKey: TimeframeKey;
  customTimeframeDays?: number;
  commitmentLevel: CommitmentKey;
  desiredOutcome: string;
  locationCountry: string;
  locationCity: string;
  businessType: "online" | "offline" | "hybrid";
  businessModel: string;
  currentContext: string;
  currency: string;
  budgetAvailable: string;
  currentResources: string[];
  targetCustomer: string;
  successSignal: string;
  contextTags: string[];
  knownBlockers: string[];
  additionalContext: string;
  domain: string;
};

export const TIMEFRAME_OPTIONS: { key: TimeframeKey; label: string }[] = [
  { key: "30d", label: "30 DAYS" },
  { key: "90d", label: "90 DAYS" },
  { key: "6m", label: "6 MONTHS" },
  { key: "1yr", label: "1 YEAR" },
  { key: "custom", label: "CUSTOM" },
];

export const COMMITMENT_OPTIONS: { key: CommitmentKey; label: string; sub: string }[] = [
  { key: "LOW", label: "LOW", sub: "1–2h / week" },
  { key: "MEDIUM", label: "MEDIUM", sub: "3–4h / week" },
  { key: "HIGH", label: "HIGH", sub: "5–7h / week" },
  { key: "INTENSE", label: "INTENSE", sub: "8h+ / week" },
];

export const BUSINESS_MODELS = [
  "SaaS",
  "Service",
  "Ecommerce",
  "Content",
  "Consulting",
  "Marketplace",
  "Local Biz",
  "Other",
] as const;

export const RESOURCE_OPTIONS = [
  "Technical Skills",
  "Existing Audience",
  "Industry Network",
  "Paying Customers",
  "Team / Co-founders",
  "Domain Experience",
  "Existing Product",
  "External Funding",
  "Brand / Credibility",
] as const;

export const CONTEXT_TAG_OPTIONS = [
  "First venture",
  "Prior failed attempt",
  "Has advisors",
  "Side project now",
  "Full-time soon",
  "Personal experience in domain",
  "Time-constrained",
  "Family commitments",
] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "INR", "AED", "BRL", "OTHER"] as const;

export function timeframeLabel(key: TimeframeKey, customDays?: number): string {
  if (key === "custom" && customDays) return `${customDays} days`;
  const found = TIMEFRAME_OPTIONS.find((t) => t.key === key);
  return found?.label.replace(" DAYS", " days").replace(" MONTHS", " months").replace(" YEAR", " year") ?? key;
}

export function timeframeForApi(form: ErectorIntakeForm): { timeframe: string; customTimeframeDays?: number } {
  if (form.timeframeKey === "custom" && form.customTimeframeDays) {
    return { timeframe: "custom", customTimeframeDays: form.customTimeframeDays };
  }
  return { timeframe: form.timeframeKey };
}

export function budgetNumber(form: ErectorIntakeForm): number {
  const n = Number(String(form.budgetAvailable).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type IntakeErrors = Partial<Record<string, string>>;

export function validateIntakeStep(step: number, form: ErectorIntakeForm): IntakeErrors {
  const errors: IntakeErrors = {};
  if (step === 1) {
    if (form.primaryGoal.trim().length < 20) errors.primaryGoal = "Goal must be at least 20 characters.";
    if (form.purpose.trim().length < 20) errors.purpose = "Purpose must be at least 20 characters.";
    if (!form.timeframeKey) errors.timeframeKey = "Select a timeframe.";
    if (form.timeframeKey === "custom" && (!form.customTimeframeDays || form.customTimeframeDays < 1)) {
      errors.customTimeframeDays = "Enter custom days (minimum 1).";
    }
    if (!form.commitmentLevel) errors.commitmentLevel = "Select commitment level.";
    if (form.desiredOutcome.trim().length < 20) errors.desiredOutcome = "Desired outcome must be at least 20 characters.";
  }
  if (step === 2) {
    if (form.locationCountry.trim().length < 2) errors.locationCountry = "Country is required.";
    if (!form.businessType) errors.businessType = "Select business type.";
    if (!form.businessModel.trim()) errors.businessModel = "Select a business model.";
    if (form.currentContext.trim().length < 20) errors.currentContext = "Current context must be at least 20 characters.";
  }
  if (step === 3) {
    if (!form.currency) errors.currency = "Select currency.";
    if (budgetNumber(form) < 1) errors.budgetAvailable = "Enter a positive budget amount.";
    if (form.currentResources.length < 1) errors.currentResources = "Select at least one resource.";
  }
  if (step === 4) {
    if (form.targetCustomer.trim().length < 20) errors.targetCustomer = "Target customer must be at least 20 characters.";
  }
  if (step === 5) {
    for (const blocker of form.knownBlockers) {
      if (blocker.trim().length > 0 && blocker.trim().length < 5) {
        errors.knownBlockers = "Each blocker must be at least 5 characters.";
        break;
      }
    }
  }
  return errors;
}

export function validateFullIntake(form: ErectorIntakeForm): IntakeErrors {
  return { ...validateIntakeStep(1, form), ...validateIntakeStep(2, form), ...validateIntakeStep(3, form), ...validateIntakeStep(4, form), ...validateIntakeStep(5, form) };
}

export type ReadinessItem = { id: string; label: string; status: "done" | "active" | "pending" };

export function computeReadiness(form: ErectorIntakeForm, currentStep: number): { items: ReadinessItem[]; percent: number } {
  const checks: { id: string; label: string; done: boolean }[] = [
    { id: "goal", label: "Goal defined (20+ chars)", done: form.primaryGoal.trim().length >= 20 },
    { id: "purpose", label: "Purpose defined", done: form.purpose.trim().length >= 20 },
    { id: "timeframe", label: "Timeframe selected", done: Boolean(form.timeframeKey) },
    { id: "commitment", label: "Commitment level", done: Boolean(form.commitmentLevel) },
    { id: "outcome", label: "Desired outcome", done: form.desiredOutcome.trim().length >= 20 },
    { id: "country", label: "Country / economy", done: form.locationCountry.trim().length >= 2 },
    { id: "business", label: "Business type & model", done: Boolean(form.businessType && form.businessModel) },
    { id: "context", label: "Starting context", done: form.currentContext.trim().length >= 20 },
    { id: "budget", label: "Budget & currency", done: budgetNumber(form) >= 1 && Boolean(form.currency) },
    { id: "resources", label: "Current resources", done: form.currentResources.length > 0 },
    { id: "customer", label: "Target customer (ICP)", done: form.targetCustomer.trim().length >= 20 },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const items: ReadinessItem[] = checks.map((c) => ({
    id: c.id,
    label: c.label,
    status: c.done ? "done" : currentStep >= 1 && !c.done ? "active" : "pending",
  }));
  return { items, percent: Math.round((doneCount / checks.length) * 100) };
}
