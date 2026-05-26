import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function observeBhudhiGovernor(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    governor: Record<string, unknown>;
    insight: string;
    topPriority: { subsystem: string; priority: string; reason: string };
  }>("/api/bhudhi/governor/observe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchGovernorHealth(blueprintId: string) {
  const res = await apiFetchEnvelope<{ health: Record<string, unknown> }>(
    "/api/bhudhi/governor/health",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId }),
    },
  );
  return unwrap(res);
}

export async function fetchGovernorHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{
      id: string;
      sessionId: string;
      interventions: unknown[];
      createdAt: string;
    }>;
  }>("/api/bhudhi/governor/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}
