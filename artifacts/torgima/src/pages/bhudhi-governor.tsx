import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  observeBhudhiGovernor,
  fetchGovernorHealth,
  fetchGovernorHistory,
} from "@/lib/bhudhi-governor-api";

type View = "control" | "priorities" | "allocation" | "recovery" | "health" | "optimization";

const VIEWS: { id: View; label: string }[] = [
  { id: "control", label: "Control" },
  { id: "priorities", label: "Priorities" },
  { id: "allocation", label: "Allocation" },
  { id: "recovery", label: "Recovery" },
  { id: "health", label: "Health" },
  { id: "optimization", label: "Optimization" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiGovernorPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("control");
  const [governor, setGovernor] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const observed = await observeBhudhiGovernor(blueprintId);
      setGovernor(observed.governor);
      const h = await fetchGovernorHealth(blueprintId);
      setHealth(h.health);
      const hist = await fetchGovernorHistory(blueprintId);
      setHistory(hist.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load meta governor");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const priorityMap = governor?.priorityMap as Record<string, unknown> | undefined;
  const entries = (priorityMap?.entries as Array<{ subsystem: string; priority: string; score: number }>) ?? [];
  const allocation = governor?.allocation as Record<string, unknown> | undefined;
  const interventions = (governor?.interventions as Array<{ type: string; subsystem: string; reason: string }>) ?? [];
  const executionPlan = governor?.executionPlan as Record<string, unknown> | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BMGE</p>
        <h1 className="text-3xl font-light">Meta Governor</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          One governor keeps every subsystem moving together — observe, prioritize, allocate, coordinate, interrupt,
          recover.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Refresh system"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      <nav className="flex flex-wrap gap-2 mb-8">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              view === v.id ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {executionPlan && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">System pulse</p>
          <p className="text-lg font-light">{String(executionPlan.note ?? "")}</p>
        </section>
      )}

      {view === "control" && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Control</h2>
          <p className="text-sm text-gray-600">
            Interventions: {interventions.length ? interventions.map((i) => `${i.type}@${i.subsystem}`).join(", ") : "none"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Blocked: {(executionPlan?.blocked as string[] | undefined)?.join(", ") || "none"}
          </p>
        </section>
      )}

      {view === "priorities" && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Priority graph</h2>
          <ul className="space-y-2 text-sm">
            {entries.map((e) => (
              <li key={e.subsystem} className="flex justify-between border-b border-gray-100 pb-2">
                <span>
                  {e.subsystem} — {e.priority}
                </span>
                <span className="text-gray-500">{Math.round(e.score * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "allocation" && allocation && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Allocation map</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries((allocation.allocation as Record<string, number>) ?? {}).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span>{v}%</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-4">{String(allocation.recommendation ?? "")}</p>
        </section>
      )}

      {view === "recovery" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Recovery modes: soft, adaptive, rollback, full — history always preserved. Use POST
          /api/bhudhi/governor/recover with target subsystem.
        </section>
      )}

      {view === "health" && health && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">{String(health.systemHealth ?? "stable")}</h2>
          <p className="text-sm text-gray-600">
            Quality {Math.round(Number(health.quality ?? 0) * 100)}% · Coordination{" "}
            {Math.round(Number(health.coordination ?? 0) * 100)}% · Efficiency{" "}
            {Math.round(Number(health.efficiency ?? 0) * 100)}%
          </p>
        </section>
      )}

      {view === "optimization" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Measure → recommend → govern → apply loop runs each observe cycle.
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10 rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Recovery timeline / history</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="text-gray-500">
                {h.createdAt?.slice(0, 16)} — session {h.id.slice(0, 8)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
