import { apiFetch } from "@/config/api";

/** Extract validation ID from any envelope shape the API may return. */
export function extractValidationId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const inner =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const result =
    inner.result && typeof inner.result === "object"
      ? (inner.result as Record<string, unknown>)
      : null;

  const candidates = [
    root.validation_id,
    root.validationId,
    root.id,
    inner.validation_id,
    inner.validationId,
    inner.id,
    result?.validation_id,
    result?.validationId,
    result?.id,
  ];

  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c);
  }
  return null;
}

export type ValidationRunResult = {
  ok: boolean;
  status: number;
  raw: unknown;
  validationId: string | null;
  redirectTo: string | null;
  errorMessage: string | null;
};

/** POST /api/v1/validation/run with full response logging (browser console). */
export async function postValidationRun(
  payload: Record<string, unknown>,
): Promise<ValidationRunResult> {
  const res = await apiFetch("/api/v1/validation/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  console.log("[VALIDATION] Full response:", JSON.stringify(data, null, 2));

  if (!res.ok) {
    const err = (data ?? {}) as Record<string, unknown>;
    const nested = err.error as { message?: string } | undefined;
    const message = String(err.message ?? nested?.message ?? `Error ${res.status}`);
    return {
      ok: false,
      status: res.status,
      raw: data,
      validationId: null,
      redirectTo: null,
      errorMessage: message,
    };
  }

  const validationId = extractValidationId(data);
  console.log("[VALIDATION] Extracted ID:", validationId);

  const envelope =
    data && typeof data === "object" && (data as { data?: unknown }).data != null
      ? ((data as { data: unknown }).data as Record<string, unknown>)
      : (data as Record<string, unknown>);

  const redirectRaw = envelope?.redirectTo ?? envelope?.redirect_to;
  const redirectTo = redirectRaw ? String(redirectRaw) : null;

  if (!validationId) {
    console.error("[VALIDATION] Cannot find ID in response:", data);
    return {
      ok: false,
      status: res.status,
      raw: data,
      validationId: null,
      redirectTo,
      errorMessage: "Validation completed but could not navigate. Check console.",
    };
  }

  return {
    ok: true,
    status: res.status,
    raw: data,
    validationId,
    redirectTo,
    errorMessage: null,
  };
}

/** Route to validation results after a successful run; use running only when explicitly requested. */
export function validationRunNavigatePath(
  validationId: string,
  redirectTo?: string | null,
): string {
  if (redirectTo?.startsWith("/validation/")) return redirectTo;
  if (redirectTo?.includes("/onboarding") && validationId) {
    return `/validation/${validationId}/results`;
  }
  return `/validation/${validationId}/results`;
}
