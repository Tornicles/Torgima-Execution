import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  analyzeBhudhiTemporal,
  fetchTemporalHistory,
  forecastBhudhiTemporal,
} from "@/lib/bhudhi-temporal-api";

type View = "timeline" | "momentum" | "windows" | "forecast" | "branches" | "schedule";

const VIEWS: { id: View; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "momentum", label: "Momentum" },
  { id: "windows", label: "Windows" },
  { id: "forecast", label: "Forecast" },
  { id: "branches", label: "Branches" },
  { id: "schedule", label: "Schedule" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiTemporalPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("timeline");
  const [temporal, setTemporal] = useState<Record<string, unknown> | null>(null);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; urgency: number; recommendation: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const analyzed = await analyzeBhudhiTemporal(blueprintId);
      setTemporal(analyzed.temporal);
      const fc = await forecastBhudhiTemporal(blueprintId);
      setForecast(fc.forecast);
      const h = await fetchTemporalHistory(blueprintId);
      setHistory(h.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load temporal intelligence");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const window = temporal?.window as Record<string, unknown> | undefined;
  const momentum = temporal?.momentum as Record<string, unknown> | undefined;
  const chronology = temporal?.chronology as Record<string, unknown> | undefined;
  const branch = temporal?.branch as Record<string, unknown> | undefined;
  const horizons = (forecast?.horizons as Array<{ days: number; confidence: number }>) ?? [];

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BTIE</p>
        <h1 className="text-3xl font-light">Temporal Intelligence</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi wins because it executes at the right time — not because it executes first.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Refresh timing"}
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

      {temporal && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Why now</p>
          <p className="text-lg font-light">{String(temporal.recommendation ?? "")}</p>
          <p className="text-sm text-gray-600 mt-2">
            Urgency {Math.round(Number(temporal.urgency ?? 0) * 100)}% · Window{" "}
            {String(window?.window ?? "—")} ({String(window?.label ?? "")})
          </p>
        </section>
      )}

      {view === "timeline" && chronology && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Time graph</h2>
          <ul className="space-y-2 text-sm">
            {((chronology.timeline as Array<{ at: string; event: string }>) ?? []).map((e, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <span>{e.event}</span>
                <span className="text-gray-500 shrink-0">{e.at?.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "momentum" && momentum && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Momentum curve</h2>
          <p className="text-2xl font-light">{String(momentum.trajectory)}</p>
          <p className="text-sm text-gray-600 mt-2">
            Score {Math.round(Number(momentum.momentum ?? 0) * 100)} · Risk{" "}
            {Math.round(Number(momentum.risk ?? 0) * 100)}%
          </p>
        </section>
      )}

      {view === "windows" && window && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Window heatmap</h2>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            {(["best", "acceptable", "avoid"] as const).map((w) => (
              <div
                key={w}
                className={`rounded-lg p-4 border ${
                  window.window === w ? "bg-gray-900 text-white border-gray-900" : "border-gray-200"
                }`}
              >
                <div className="uppercase text-xs tracking-widest">{w}</div>
                <div className="mt-2 text-lg">
                  {w === String(window.window) ? `${Math.round(Number(window.score ?? 0))}` : "—"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === "forecast" && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Forecast tree</h2>
          <ul className="space-y-3 text-sm">
            {horizons.map((h) => (
              <li key={h.days} className="flex justify-between">
                <span>{h.days}d horizon</span>
                <span className="text-gray-500">{Math.round(h.confidence * 100)}% confidence</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "branches" && branch && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">Recommended path</h2>
          <p className="text-sm mb-4">{String(branch.recommendedPath)}</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {((branch.alternatives as Array<{ path: string; timeDays: number }>) ?? []).map((a, i) => (
              <li key={i}>
                {a.path} · ~{a.timeDays}d
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "schedule" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Adaptive scheduling protects sleep, health, and signals. Use POST /api/bhudhi/temporal/schedule for
          full sequence output.
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10 rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Temporal history</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border-b border-gray-100 pb-2">
                <span className="text-gray-500">{h.createdAt?.slice(0, 16)}</span>
                <p>{h.recommendation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
