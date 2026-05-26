import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function createBhudhiDecision(body: {
  blueprintId: string;
  trigger: string;
  goal: string;
  recommendationId?: string;
}) {
  const res = await apiFetchEnvelope<{ decision: Record<string, unknown> }>(
    "/api/bhudhi/decision/create",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return unwrap(res);
}

export async function fetchDecisionHistory(blueprintId: string, limit = 20) {
  const res = await apiFetchEnvelope<{
    decisions: Array<{
      decisionId: string;
      goal: string;
      selected: string;
      confidence: number;
      status: string;
    }>;
  }>("/api/bhudhi/decision/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}

export async function replayBhudhiDecision(decisionId: string, branchOptionId?: string) {
  const res = await apiFetchEnvelope<{ replay: Record<string, unknown> }>(
    "/api/bhudhi/decision/replay",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId, branchOptionId }),
    },
  );
  return unwrap(res);
}
