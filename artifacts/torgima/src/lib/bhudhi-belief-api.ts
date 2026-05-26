import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function fetchBeliefHistory(blueprintId: string, limit = 20) {
  const res = await apiFetchEnvelope<{
    beliefs: Array<{
      beliefId: string;
      type: string;
      statement: string;
      state: string;
      confidence: number;
      origin: string;
    }>;
  }>("/api/bhudhi/belief/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}

export async function replayBeliefValidate(beliefId: string) {
  const res = await apiFetchEnvelope<{ belief: Record<string, unknown> }>(
    "/api/bhudhi/belief/validate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beliefId }),
    },
  );
  return unwrap(res);
}
