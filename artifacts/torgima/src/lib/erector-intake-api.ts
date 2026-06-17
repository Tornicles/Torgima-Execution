/**
 * DOC B4b — client helpers for authenticated Erector deep intake.
 */
import { apiFetch } from "@/config/api";
import type { ErectorFreeReport } from "@/lib/erector-free-api";

export type IntakeTier = "pro" | "authenticated";

export type IntakeSession = {
  id: string;
  blueprint_id?: string | null;
  tier: IntakeTier;
  status: string;
  current_section: number;
  sections_completed: number[];
  section_1_data: Record<string, unknown> | null;
  section_2_data: Record<string, unknown> | null;
  section_3_data: Record<string, unknown> | null;
  section_4_data: Record<string, unknown> | null;
  section_5_data: Record<string, unknown> | null;
  section_6_data: Record<string, unknown> | null;
  section_7_data: Record<string, unknown> | null;
  section_8_data: Record<string, unknown> | null;
  section_9_data?: Record<string, unknown> | null;
  validation_id: string | null;
  prefilled_from_handoff: boolean | null;
  started_at: string | null;
  completed_at: string | null;
  last_saved_at: string | null;
  completion_percentage?: number | null;
  missing_fields?: string[] | null;
  ambiguity_flags?: string[] | null;
  contradiction_flags?: string[] | null;
  required_missing_fields?: string[] | null;
  submitted_at?: string | null;
  baseline_requested_at?: string | null;
  baseline_completed_at?: string | null;
  baseline_failed_at?: string | null;
};

export type ErectorPaidReport = ErectorFreeReport & {
  goal_structured: {
    cleaned_goal: string;
    measurable_outcome: string;
    feasibility_note?: string;
  };
  purpose_structured: {
    problem: string;
    target_user: string;
    change: string;
    value: string;
  };
  risk_flags: string[];
  policy_rules: string[];
  winning_conditions: string[];
  failure_conditions: string[];
  selected_path: "current" | "adjusted" | "alternative";
  section_strategy_recommendation: string;
  section_competitive_position: string;
  section_90_day_action_map: string;
};

export type CompleteIntakeResult = {
  validation_id: string;
  report: ErectorPaidReport;
  tier: string;
  blueprint_id?: string;
  dashboard_mode?: "full";
  redirect_to?: string;
};

export type PaidReportResult = {
  validation_id: string;
  tier: string;
  status: string;
  report: ErectorPaidReport;
  blueprint_id: string | null;
  blueprint_created: boolean | null;
  completed_at: string | null;
};

const SESSION_STORAGE_KEY = "torgima_erector_intake_session_v1";

async function parseEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!res.ok || !json.ok || json.data === undefined) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

export function getStoredIntakeSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeIntakeSessionId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // ignore quota errors
  }
}

export function clearStoredIntakeSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function createIntakeSession(
  tier: IntakeTier = "authenticated",
  handoffToken?: string,
  blueprintId?: string,
): Promise<IntakeSession> {
  const res = await apiFetch("/api/erector/intake/session", {
    method: "POST",
    body: JSON.stringify({
      tier,
      ...(blueprintId ? { blueprint_id: blueprintId } : {}),
      ...(handoffToken ? { handoff_token: handoffToken } : {}),
    }),
  });
  const session = await parseEnvelope<IntakeSession>(res);
  storeIntakeSessionId(session.id);
  return session;
}

export async function fetchIntakeSession(sessionId: string): Promise<IntakeSession> {
  const res = await apiFetch(`/api/erector/intake/session/${sessionId}`);
  return parseEnvelope<IntakeSession>(res);
}

export async function saveIntakeSection(
  sessionId: string,
  section: number,
  data: Record<string, unknown>,
): Promise<IntakeSession> {
  const res = await apiFetch(`/api/erector/intake/session/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ section, data }),
  });
  return parseEnvelope<IntakeSession>(res);
}

export async function validateIntakeSession(sessionId: string): Promise<CompleteIntakeResult> {
  const res = await apiFetch(`/api/erector/intake/session/${sessionId}/validate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const result = await parseEnvelope<CompleteIntakeResult>(res);
  return result;
}

export async function submitIntakeSession(sessionId: string): Promise<CompleteIntakeResult> {
  const res = await apiFetch(`/api/erector/intake/session/${sessionId}/submit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const result = await parseEnvelope<CompleteIntakeResult>(res);
  clearStoredIntakeSessionId();
  return result;
}

export async function fetchPaidReport(validationId: string): Promise<PaidReportResult> {
  const res = await apiFetch(`/api/erector/paid/report/${validationId}`);
  return parseEnvelope<PaidReportResult>(res);
}

export const INTAKE_STEP_LABELS = [
  "Project Identity",
  "Target User / Customer",
  "Market / Competition",
  "Offer / Product / Revenue",
  "Resources / Capability",
  "Timeline / Commitment",
  "Risks / Constraints / Dependencies",
  "Strategy / Direction Preference",
  "Proof / Evidence (Optional)",
] as const;
