import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function analyzeBhudhiTemporal(blueprintId: string, goal?: string) {
  const res = await apiFetchEnvelope<{
    temporal: Record<string, unknown>;
    insight: string;
    urgency: number;
  }>("/api/bhudhi/temporal/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, goal: goal ?? "Blueprint timing" }),
  });
  return unwrap(res);
}

export async function fetchTemporalHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{
      id: string;
      eventType: string;
      urgency: number;
      recommendation: string;
      createdAt: string;
    }>;
  }>("/api/bhudhi/temporal/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}

export async function forecastBhudhiTemporal(blueprintId: string) {
  const res = await apiFetchEnvelope<{ forecast: Record<string, unknown> }>(
    "/api/bhudhi/temporal/forecast",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}
