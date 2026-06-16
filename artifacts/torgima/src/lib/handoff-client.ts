/**
 * DOC B4c — Client helpers for Erector upgrade handoff tokens.
 */
import { apiFetch } from "@/config/api";

export const PENDING_HANDOFF_TOKEN_KEY = "torgima_pending_handoff_token";
export const HANDOFF_PREFILL_KEY = "torgima_handoff_prefill_v1";
export const HANDOFF_TOKEN_KEY = "torgima_handoff_token";
export const INTAKE_SKIP_KEY = "torgima_intake_skip_v1";

export type HandoffSourceTier = "free" | "pro";
export type HandoffTargetTier = "pro" | "torgima";

export type HandoffCreateResult = {
  handoff_token: string;
  expires_at: string;
  handoff_id: string;
};

export type HandoffConsumeResult = {
  source_tier: string;
  target_tier: string;
  prefill: Record<string, unknown>;
  intake_skip: boolean;
  redirect_to?: string;
  dashboard_mode?: "review" | "limited";
};

export type StoredHandoffPrefill = {
  prefill: Record<string, unknown>;
  intake_skip: boolean;
  source_tier: string;
  target_tier: string;
};

async function parseEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!res.ok || !json.ok || json.data === undefined) {
    throw new Error(json.error?.message ?? "Handoff request failed");
  }
  return json.data;
}

export function captureHandoffTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("handoff");
  if (!token) return sessionStorage.getItem(PENDING_HANDOFF_TOKEN_KEY);

  try {
    sessionStorage.setItem(PENDING_HANDOFF_TOKEN_KEY, token);
    localStorage.setItem(HANDOFF_TOKEN_KEY, token);
    params.delete("handoff");
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    // ignore storage errors
  }
  return token;
}

export function getPendingHandoffToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PENDING_HANDOFF_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearPendingHandoffToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_HANDOFF_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function storeHandoffToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HANDOFF_TOKEN_KEY, token);
    sessionStorage.setItem(PENDING_HANDOFF_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function getStoredHandoffToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(HANDOFF_TOKEN_KEY) ?? sessionStorage.getItem(PENDING_HANDOFF_TOKEN_KEY);
  } catch {
    return null;
  }
}
export function storeHandoffPrefill(result: HandoffConsumeResult): void {
  if (typeof window === "undefined") return;
  const payload: StoredHandoffPrefill = {
    prefill: result.prefill,
    intake_skip: result.intake_skip,
    source_tier: result.source_tier,
    target_tier: result.target_tier,
  };
  try {
    sessionStorage.setItem(HANDOFF_PREFILL_KEY, JSON.stringify(payload));
    if (result.intake_skip) {
      sessionStorage.setItem(INTAKE_SKIP_KEY, "true");
    } else {
      sessionStorage.removeItem(INTAKE_SKIP_KEY);
    }
  } catch {
    // ignore
  }
}

export function getStoredHandoffPrefill(): StoredHandoffPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HANDOFF_PREFILL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredHandoffPrefill;
  } catch {
    return null;
  }
}

export function shouldSkipIntake(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(INTAKE_SKIP_KEY) === "true";
  } catch {
    return false;
  }
}

export function clearHandoffPrefill(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(HANDOFF_PREFILL_KEY);
    sessionStorage.removeItem(INTAKE_SKIP_KEY);
    clearPendingHandoffToken();
  } catch {
    // ignore
  }
}

export async function createHandoffToken(
  sourceTier: HandoffSourceTier,
  targetTier: HandoffTargetTier,
  sourceValidationId: string,
): Promise<HandoffCreateResult> {
  const res = await apiFetch("/api/handoff/create", {
    method: "POST",
    body: JSON.stringify({
      source_tier: sourceTier,
      target_tier: targetTier,
      source_validation_id: sourceValidationId,
    }),
  });
  return parseEnvelope<HandoffCreateResult>(res);
}

export async function consumeHandoffToken(token: string): Promise<HandoffConsumeResult> {
  const res = await apiFetch("/api/handoff/consume", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  const result = await parseEnvelope<HandoffConsumeResult>(res);
  storeHandoffPrefill(result);
  clearPendingHandoffToken();
  return result;
}

/** Call after auth completes to consume a pending ?handoff= token. */
export async function handlePostAuthHandoff(): Promise<string | null> {
  const pending = getPendingHandoffToken();
  if (!pending) return null;
  try {
    const result = await consumeHandoffToken(pending);
    return result.redirect_to ?? (result.intake_skip ? "/dashboard" : "/onboarding/intake");
  } catch {
    clearPendingHandoffToken();
    return null;
  }
}

export function buildSignupUrlWithHandoff(handoffToken: string): string {
  return `/signup?handoff=${encodeURIComponent(handoffToken)}`;
}

export function buildIntakeUrlWithHandoff(handoffToken: string, tier?: "pro" | "authenticated"): string {
  const tierQuery = tier === "pro" ? "&tier=pro" : "";
  return `/onboarding/intake?handoff=${encodeURIComponent(handoffToken)}${tierQuery}`;
}

/** On page load, stash ?handoff= from URL for post-auth consumption. */
export function initHandoffFromUrl(): void {
  captureHandoffTokenFromUrl();
}

if (typeof window !== "undefined") {
  initHandoffFromUrl();
}
