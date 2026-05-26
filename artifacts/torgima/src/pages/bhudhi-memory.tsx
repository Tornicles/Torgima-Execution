import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  fetchMemoryStats,
  fetchMemoryTimeline,
  migrateMemoryToGraph,
  queryMemoryGraph,
} from "@/lib/bhudhi-memory-api";

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiMemoryPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [stats, setStats] = useState<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  } | null>(null);
  const [nodes, setNodes] = useState<Array<Record<string, unknown>>>([]);
  const [timeline, setTimeline] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      await migrateMemoryToGraph(blueprintId);
      const s = await fetchMemoryStats(blueprintId);
      setStats(s.stats);
      const q = await queryMemoryGraph(blueprintId, undefined, "all memory");
      setNodes(q.results.nodes);
      const t = await fetchMemoryTimeline(blueprintId);
      setTimeline(t.timeline);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory graph");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    if (blueprintId) void reload();
  }, [blueprintId, reload]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-gray-500">Unified Memory</p>
        <h1 className="text-3xl font-light">Memory Graph</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          One graph for beliefs, decisions, signals, investigations, and learnings — nodes, edges, and a
          single query interface.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Migrate & refresh"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi/kernel?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Kernel
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {stats && (
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-xs uppercase text-gray-500">Nodes</p>
            <p className="text-2xl font-light">{stats.totalNodes}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-xs uppercase text-gray-500">Edges</p>
            <p className="text-2xl font-light">{stats.totalEdges}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-5">
            <p className="text-xs uppercase text-gray-500">Types</p>
            <p className="text-sm text-gray-600">{Object.keys(stats.nodesByType).length} kinds</p>
          </div>
        </section>
      )}

      <div className="grid gap-6 sm:grid-cols-2 mb-8">
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Memory nodes</p>
          <ul className="text-sm text-gray-600 space-y-1 max-h-64 overflow-y-auto">
            {nodes.map((n, i) => (
              <li key={i}>
                {String(n.nodeType)} · {String(n.summary).slice(0, 60)}
              </li>
            ))}
            {nodes.length === 0 && <li>No nodes yet — run migrate</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Timeline</p>
          <ul className="text-sm text-gray-600 space-y-1 max-h-64 overflow-y-auto">
            {timeline.map((t, i) => (
              <li key={i}>
                {String(t.event)} · {new Date(String(t.timestamp)).toLocaleString()}
              </li>
            ))}
            {timeline.length === 0 && <li>No timeline entries</li>}
          </ul>
        </div>
      </div>

      {stats && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-light mb-3">Nodes by type</h2>
          <ul className="text-sm text-gray-600 grid sm:grid-cols-2 gap-2">
            {Object.entries(stats.nodesByType).map(([type, count]) => (
              <li key={type}>
                {type}: {count}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
