import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function verifyBhudhiSecurity(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    security: Record<string, unknown>;
    insight: string;
  }>("/api/bhudhi/security/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchSecurityHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{
      id: string;
      trustScore: number;
      risk: number;
      decision: string;
      createdAt: string;
    }>;
  }>("/api/bhudhi/security/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}

export async function fetchSecurityThreats(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    threats: Array<{ threat: string; severity: string; containment: string }>;
  }>("/api/bhudhi/security/threat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}
