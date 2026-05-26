import { apiFetchEnvelope, type ApiEnvelope } from "@/lib/torgima-api";

function unwrap<T>(res: ApiEnvelope<T>): T {
  if (!res.ok || res.data === undefined) throw new Error(res.error?.message ?? "Request failed");
  return res.data;
}

export async function queryMemoryGraph(
  blueprintId: string,
  nodeTypes?: string[],
  query?: string,
) {
  const res = await apiFetchEnvelope<{
    results: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
    count: number;
  }>("/api/bhudhi/memory/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId, nodeTypes, query }),
  });
  return unwrap(res);
}

export async function fetchMemoryStats(blueprintId: string) {
  const res = await apiFetchEnvelope<{
    stats: { totalNodes: number; totalEdges: number; nodesByType: Record<string, number> };
  }>(`/api/bhudhi/memory/stats?blueprintId=${encodeURIComponent(blueprintId)}`);
  return unwrap(res);
}

export async function migrateMemoryToGraph(blueprintId: string) {
  const res = await apiFetchEnvelope<{ result: Record<string, unknown> }>("/api/bhudhi/memory/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blueprintId }),
  });
  return unwrap(res);
}

export async function fetchMemoryTimeline(blueprintId: string, limit = 30) {
  const res = await apiFetchEnvelope<{
    timeline: Array<Record<string, unknown>>;
    count: number;
  }>(`/api/bhudhi/memory/timeline?blueprintId=${encodeURIComponent(blueprintId)}&limit=${limit}`);
  return unwrap(res);
}
