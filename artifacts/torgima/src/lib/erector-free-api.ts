/**
 * DOC B4 — client helpers for public free Project Intelligence validation.
 */
import { apiFetch } from "@/config/api";
import { storeHandoffToken } from "@/lib/handoff-client";

const FINGERPRINT_KEY = "torgima_free_pi_fingerprint";
const SESSION_KEY = "torgima_free_pi_session";

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

export type FreeErectorPath = {
  path_name: string;
  what_it_means: string;
  likely_outcome: string;
  main_risk: string;
};

export type FreeValidatePayload = {
  idea_or_goal: string;
  industry_or_domain: string;
  location: string;
  budget_range: string;
  timeline: string;
  additional_context?: string;
  fingerprint: string;
  anonymous_session_id: string;
};

export type FreeValidateResult = {
  validation_id: string;
  is_free_tier_preview: true;
  title: string;
  summary: string;
  score: number;
  score_label: string;
  verdict_label: string;
  recommended_direction: string;
  current_path: FreeErectorPath;
  adjusted_path: FreeErectorPath;
  alternative_path: FreeErectorPath;
  top_risks: string[];
  top_opportunities: string[];
  market_snapshot: string;
  execution_snapshot: string;
  next_steps: string[];
  upgrade_reasons: string[];
  handoff_token?: string;
  handoff_expires_at?: string;
  remaining_free_validations: number;
  upgrade_url: string;
  fallback_used?: boolean;
  report: ErectorFreeReport;
  /** @deprecated use remaining_free_validations */
  remaining_free?: number;
};

export class FreeValidationLimitError extends Error {
  readonly code = "FREE_VALIDATION_LIMIT_REACHED";
  readonly upgradeRequired = true;
  readonly upgradeUrl = "/upgrade";

  constructor(message = "You have used your free validations.") {
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

export function getOrCreateAnonymousSessionId(): string {
  if (typeof window === "undefined") return "server-render";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
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
    error?: { code?: string; message?: string; upgrade_url?: string };
  };

  if (
    res.status === 429 ||
    json.error?.code === "FREE_VALIDATION_LIMIT_REACHED" ||
    json.error?.code === "LIMIT_REACHED"
  ) {
    throw new FreeValidationLimitError(json.error?.message);
  }
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error?.message ?? "Unable to analyze your project right now.");
  }
  if (json.data.handoff_token) {
    storeHandoffToken(json.data.handoff_token);
  }
  return {
    ...json.data,
    remaining_free: json.data.remaining_free_validations,
  };
}

export async function downloadFreeReportJson(
  validationId: string,
  fingerprint?: string,
): Promise<FreeValidateResult> {
  const query = fingerprint ? `?fingerprint=${encodeURIComponent(fingerprint)}` : "";
  const res = await apiFetch(`/api/erector/free/report/${validationId}${query}`);
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: FreeValidateResult;
    error?: { message?: string };
  };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error?.message ?? "Unable to download report.");
  }
  return json.data;
}

export const BUDGET_RANGE_OPTIONS = [
  { value: "$0 - $500", label: "$0 – $500" },
  { value: "under_1k", label: "Under $1,000" },
  { value: "1k_5k", label: "$1,000 – $5,000" },
  { value: "5k_20k", label: "$5,000 – $20,000" },
  { value: "20k_plus", label: "$20,000+" },
];

export const TIMELINE_OPTIONS = [
  { value: "30 days", label: "30 days" },
  { value: "90 days", label: "90 days" },
  { value: "1_month", label: "1 month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "12_months_plus", label: "12 months or more" },
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
