import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function fetchIdentityProfile(blueprintId: string) {
  const res = await apiFetchEnvelope<{ identity: Record<string, unknown> }>(
    "/api/bhudhi/identity/profile",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, trigger: "DASHBOARD_VIEW" }),
    },
  );
  return unwrap(res);
}

export async function fetchIdentityHistory(blueprintId: string, limit = 10) {
  const res = await apiFetchEnvelope<{
    history: Array<{
      profileId: string;
      executionProfile: string;
      growthDirection: string | null;
      confidence: number;
    }>;
  }>("/api/bhudhi/identity/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}

export async function fetchIdentityDrift(blueprintId: string) {
  const res = await apiFetchEnvelope<{ drift: Record<string, unknown> }>(
    "/api/bhudhi/identity/drift",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}
