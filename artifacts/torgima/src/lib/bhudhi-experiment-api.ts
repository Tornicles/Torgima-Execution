import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function createBhudhiExperiment(blueprintId: string, goal: string) {
  const res = await apiFetchEnvelope<{ experiment: Record<string, unknown> }>(
    "/api/bhudhi/experiment/create",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blueprintId, goal, metrics: ["impact", "quality", "speed"] }),
    },
  );
  return unwrap(res);
}

export async function fetchExperimentHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{ experimentId: string; goal: string; status: string }>;
  }>("/api/bhudhi/experiment/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}
