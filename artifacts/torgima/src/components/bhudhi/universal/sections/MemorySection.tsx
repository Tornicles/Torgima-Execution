import { useCallback, useEffect, useState } from "react";
import {
  fetchMemoryStats,
  fetchMemoryTimeline,
  migrateMemoryToGraph,
  queryMemoryGraph,
} from "@/lib/bhudhi-memory-api";

export function MemorySection({ blueprintId }: { blueprintId: string }) {
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
      setError(e instanceof Error ? e.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    if (blueprintId) void reload();
  }, [blueprintId, reload]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">Memory</h1>
          <p className="text-gray-600">Unified knowledge graph and timeline</p>
        </div>
        <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
          {loading ? "Loading…" : "Migrate & refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stats && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Statistics</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total nodes</div>
              <div className="text-2xl font-light">{stats.totalNodes}</div>
            </div>
            <div>
              <div className="text-gray-600">Total edges</div>
              <div className="text-2xl font-light">{stats.totalEdges}</div>
            </div>
          </div>
          {Object.keys(stats.nodesByType).length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Nodes by type</h3>
              {Object.entries(stats.nodesByType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">{type}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {nodes.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">Recent nodes</h2>
          <ul className="space-y-2">
            {nodes.slice(0, 10).map((n) => (
              <li key={String(n.id ?? n.nodeId)} className="border border-gray-200 rounded-lg p-3 text-sm">
                <span className="text-gray-500 uppercase text-xs">{String(n.nodeType)}</span>
                <p className="font-medium mt-1">{String(n.summary ?? "")}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {timeline.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">Timeline</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            {timeline.slice(0, 8).map((t, i) => (
              <li key={String(t.id ?? i)} className="font-mono text-xs">
                {String(t.event)} · {String(t.timestamp ?? "")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
