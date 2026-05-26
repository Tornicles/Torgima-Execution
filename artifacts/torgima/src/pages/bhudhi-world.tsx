import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { predictBhudhiWorld, syncBhudhiWorld } from "@/lib/bhudhi-world-api";

type View = "world" | "entities" | "states" | "relationships" | "timeline" | "constraints" | "forecast";

const VIEWS: { id: View; label: string }[] = [
  { id: "world", label: "World" },
  { id: "entities", label: "Entities" },
  { id: "states", label: "States" },
  { id: "relationships", label: "Relationships" },
  { id: "timeline", label: "Timeline" },
  { id: "constraints", label: "Constraints" },
  { id: "forecast", label: "Forecast" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiWorldPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("world");
  const [world, setWorld] = useState<Record<string, unknown> | null>(null);
  const [prediction, setPrediction] = useState<{ next: string; confidence: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const synced = await syncBhudhiWorld({ blueprintId, trigger: "DASHBOARD_VIEW" });
      setWorld(synced.world);
      const pred = await predictBhudhiWorld(blueprintId);
      setPrediction(pred.prediction);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load world model");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ws = world?.worldState as Record<string, unknown> | undefined;
  const entities = (ws?.entities as Array<{ type: string; label: string; entityId: string }>) ?? [];
  const relationships = (ws?.relationships as Array<{ type: string; fromEntityId: string; toEntityId: string }>) ?? [];
  const constraints = ws?.constraints as { allowed?: boolean; blocked?: string[]; why?: string } | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BWME</p>
        <h1 className="text-3xl font-light">World Model</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          One unified reality — entities, states, relationships, causality, and constraints. Bhudhi understands reality
          because it maintains a living world model.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Syncing…" : "Sync world"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 mb-6">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              view === v.id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mb-4 p-4 border border-red-200 bg-red-50 text-red-800 text-sm rounded-xl">{error}</div>
      )}

      {view === "world" && world && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm space-y-2">
          <div>
            Confidence: {Math.round((Number(world.confidence) || 0) * 100)}%
          </div>
          <div>Entities: {entities.length}</div>
          <div>Relationships: {relationships.length}</div>
          {Array.isArray(world.changes) && (
            <div>Changes: {(world.changes as string[]).slice(0, 4).join("; ")}</div>
          )}
        </div>
      )}

      {view === "entities" && (
        <div className="space-y-2">
          {entities.length === 0 ? (
            <p className="text-sm text-gray-500">Sync world to populate entities.</p>
          ) : (
            entities.map((e) => (
              <div key={e.entityId} className="border border-gray-200 rounded-lg p-3 text-sm">
                <span className="text-xs text-gray-500 uppercase">{e.type}</span>
                <div className="font-medium">{e.label}</div>
              </div>
            ))
          )}
        </div>
      )}

      {view === "relationships" && (
        <div className="space-y-2 text-sm">
          {relationships.length === 0 ? (
            <p className="text-gray-500">No relationships yet.</p>
          ) : (
            relationships.map((r, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3">
                {r.type}: {r.fromEntityId.slice(0, 8)} → {r.toEntityId.slice(0, 8)}
              </div>
            ))
          )}
        </div>
      )}

      {view === "constraints" && (
        <p className="text-sm text-gray-600">
          {constraints?.allowed
            ? constraints.why ?? "All constraints satisfied"
            : `Blocked: ${constraints?.blocked?.join(", ") ?? "unknown"} — ${constraints?.why}`}
        </p>
      )}

      {view === "forecast" && prediction && (
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase">Prediction</div>
          <p className="mt-1 text-sm">{prediction.next}</p>
          <p className="text-xs text-gray-500 mt-2">{Math.round(prediction.confidence * 100)}% confidence</p>
        </div>
      )}

      {(view === "states" || view === "timeline") && (
        <p className="text-sm text-gray-600">
          {view === "states"
            ? "State engine tracks current, previous, predicted, and desired states with deltas."
            : "Timeline stores world snapshots — rollback, forecast, branch, and replay."}
        </p>
      )}
    </div>
  );
}
