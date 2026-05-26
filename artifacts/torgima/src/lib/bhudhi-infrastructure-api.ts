import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function observeBhudhiInfrastructure(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    infrastructure: Record<string, unknown>;
    insight: string;
  }>("/api/bhudhi/infra/observe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchInfrastructureHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{ id: string; environment: string; risk: number; createdAt: string }>;
  }>("/api/bhudhi/infra/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}

export async function scaleBhudhiInfrastructure(blueprintId: string) {
  const res = await apiFetchEnvelope<{ scale: Record<string, unknown> }>("/api/bhudhi/infra/scale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}
