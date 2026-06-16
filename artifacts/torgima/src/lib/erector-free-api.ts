/**
 * DOC B4 — client helpers for public free Project Intelligence validation.
 */
import { apiFetch } from "@/config/api";
import { storeHandoffToken } from "@/lib/handoff-client";

const FINGERPRINT_KEY = "torgima_free_pi_fingerprint";

export type ErectorFreeVerdict = "proceed" | "adjust" | "pivot";

export type ErectorFreeReport = {
  verdict: ErectorFreeVerdict;
  validation_score: number;
  top_strengths: string[];
  top_risks: string[];
  primary_direction: string;
  alternative_direction?: string;
  success_conditions: string[];
  failure_warnings: string[];
  section_recommendation: string;
  section_health_score_breakdown: string;
  section_market_reality: string;
  section_financial_assessment: string;
  section_execution_reality: string;
  section_strengths: string;
  section_risk_flags: string;
  section_best_direction: string;
  section_alternative_direction: string;
  section_success_conditions: string;
  section_failure_warnings: string;
};

export type FreeValidatePayload = {
  industry: string;
  location: string;
  budget_range: "under_1k" | "1k_5k" | "5k_20k" | "20k_plus";
  timeline: "1_month" | "3_months" | "6_months" | "12_months_plus";
  additional_context?: string;
  fingerprint: string;
};

export type FreeValidateResult = {
  validation_id: string;
  report: ErectorFreeReport;
  remaining_free: number;
  upgrade_url: string;
  fallback_used?: boolean;
  handoff_token?: string;
  handoff_expires_at?: string;
};

export class FreeValidationLimitError extends Error {
  readonly code = "LIMIT_REACHED";
  readonly upgradeRequired = true;

  constructor(message = "You've used your 3 free checks.") {
    super(message);
    this.name = "FreeValidationLimitError";
  }
}

export function getOrCreateFingerprint(): string {
  if (typeof window === "undefined") return "server-render";
  try {
    let fp = localStorage.getItem(FINGERPRINT_KEY);
    if (!fp) {
      fp = crypto.randomUUID();
      localStorage.setItem(FINGERPRINT_KEY, fp);
    }
    return fp;
  } catch {
    return crypto.randomUUID();
  }
}

export async function submitFreeValidation(payload: FreeValidatePayload): Promise<FreeValidateResult> {
  const res = await apiFetch("/api/erector/free/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: FreeValidateResult;
    error?: { code?: string; message?: string };
  };

  if (res.status === 429 || json.error?.code === "LIMIT_REACHED") {
    throw new FreeValidationLimitError(json.error?.message);
  }
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error?.message ?? "Unable to analyze your project right now.");
  }
  if (json.data.handoff_token) {
    storeHandoffToken(json.data.handoff_token);
  }
  return json.data;
}

export const BUDGET_RANGE_OPTIONS = [
  { value: "under_1k" as const, label: "Under $1,000" },
  { value: "1k_5k" as const, label: "$1,000 – $5,000" },
  { value: "5k_20k" as const, label: "$5,000 – $20,000" },
  { value: "20k_plus" as const, label: "$20,000+" },
];

export const TIMELINE_OPTIONS = [
  { value: "1_month" as const, label: "1 month" },
  { value: "3_months" as const, label: "3 months" },
  { value: "6_months" as const, label: "6 months" },
  { value: "12_months_plus" as const, label: "12 months or more" },
];

export const INDUSTRY_SUGGESTIONS = [
  "Software / SaaS",
  "E-commerce",
  "Consulting / Services",
  "Education / Coaching",
  "Health & Wellness",
  "Creative / Media",
  "Local business",
  "Other",
];

export const VERDICT_LABELS: Record<ErectorFreeVerdict, string> = {
  proceed: "Proceed",
  adjust: "Needs Adjustment",
  pivot: "Change Direction",
};
