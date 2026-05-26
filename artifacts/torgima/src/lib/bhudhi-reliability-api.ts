import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function checkBhudhiReliability(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    reliability: Record<string, unknown>;
    insight: string;
    resilienceScore: number;
  }>("/api/bhudhi/reliability/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchReliabilityHealth(blueprintId: string) {
  const res = await apiFetchEnvelope<{ health: Record<string, unknown> }>(
    "/api/bhudhi/reliability/health",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function fetchReliabilityHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{
      id: string;
      health: number;
      risk: number;
      failureProbability: number;
      createdAt: string;
    }>;
  }>("/api/bhudhi/reliability/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}
