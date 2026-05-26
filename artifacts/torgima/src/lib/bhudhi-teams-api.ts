import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function createBhudhiTeam(blueprintId: string, name?: string) {
  const res = await apiFetchEnvelope<{
    team: Record<string, unknown>;
    insight: string;
  }>("/api/bhudhi/teams/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, name: name ?? "Blueprint Team" }),
  });
  return unwrap(res);
}

export async function fetchTeamHealth(blueprintId: string) {
  const res = await apiFetchEnvelope<{ health: Record<string, unknown> }>("/api/bhudhi/teams/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchTeamHistory(blueprintId: string, limit = 15) {
  const res = await apiFetchEnvelope<{
    history: Array<{ teamId: string; name: string; alignment: number; updatedAt: string }>;
  }>("/api/bhudhi/teams/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, limit }),
  });
  return unwrap(res);
}
