import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function createBhudhiSimulation(blueprintId: string, goal?: string, seed?: string) {
  const res = await apiFetchEnvelope<{
    simulation: Record<string, unknown>;
    insight: string;
  }>("/api/bhudhi/erector/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, goal, seed, mode: "STANDARD", scenario: "realistic" }),
  });
  return unwrap(res);
}

export async function runBhudhiSimulation(blueprintId: string, scenario?: string) {
  const res = await apiFetchEnvelope<{ simulation: Record<string, unknown> }>("/api/bhudhi/erector/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, scenario: scenario ?? "realistic" }),
  });
  return unwrap(res);
}

export async function fetchSimulationHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{
      simulationId: string;
      goal: string | null;
      confidence: number;
      recommendation: string | null;
      createdAt: string;
    }>;
  }>("/api/bhudhi/erector/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}

export async function compareSimulations(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    comparison: { runs: Array<{ simulationId: string; overall: number; recommendation: string }>; winner: string };
  }>("/api/bhudhi/erector/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}
