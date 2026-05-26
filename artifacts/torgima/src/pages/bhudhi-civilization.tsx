import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  createBhudhiCivilization,
  fetchCivilizationForecast,
  fetchCivilizationHistory,
  fetchCivilizationResilience,
} from "@/lib/bhudhi-civilization-api";

type View = "population" | "institutions" | "economy" | "resilience" | "evolution" | "forecast";

const VIEWS: { id: View; label: string }[] = [
  { id: "population", label: "Population" },
  { id: "institutions", label: "Institutions" },
  { id: "economy", label: "Economy" },
  { id: "resilience", label: "Resilience" },
  { id: "evolution", label: "Evolution" },
  { id: "forecast", label: "Forecast" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiCivilizationPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("population");
  const [civilization, setCivilization] = useState<Record<string, unknown> | null>(null);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);
  const [resilience, setResilience] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<
    Array<{ civilizationId: string; name: string; resilience: number; trajectory: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createBhudhiCivilization(blueprintId);
      setCivilization(created.civilization);
      const f = await fetchCivilizationForecast(blueprintId);
      setForecast(f.forecast);
      const r = await fetchCivilizationResilience(blueprintId);
      setResilience(r.resilience);
      const hist = await fetchCivilizationHistory(blueprintId);
      setHistory(hist.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load civilization intelligence");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const state = civilization?.civilizationState as Record<string, unknown> | undefined;
  const evolution = civilization?.evolution as Record<string, unknown> | undefined;
  const horizons = (forecast?.horizons as Array<Record<string, unknown>>) ?? [];

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BCIE</p>
        <h1 className="text-3xl font-light">Civilization Intelligence</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          System-scale evolution — institutions, ecosystems, economies, and long-horizon outcomes.
          Civilization intelligence advises; it never governs reality.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Observe civilization"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {civilization && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Civilization state</p>
          <p className="text-2xl font-light capitalize">
            {String(civilization.evolutionMode)} · {String(civilization.trajectory)}
          </p>
          <p className="text-sm text-gray-600 mt-2">{String(civilization.recommendation ?? "")}</p>
        </section>
      )}

      <nav className="flex flex-wrap gap-2 mb-6">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 text-sm rounded-full border ${
              view === v.id ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 sm:grid-cols-2 mb-8">
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Civilization graph</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>Population: {String(state?.population ?? "—")}</li>
            <li>Institutions: {String(state?.institutions ?? "—")}</li>
            <li>Markets: {String(state?.markets ?? "—")}</li>
            <li>Ecosystems: {String(state?.ecosystems ?? "—")}</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Evolution curve</p>
          <p className="text-lg font-light capitalize">{String(evolution?.mode ?? civilization?.evolutionMode ?? "—")}</p>
          <p className="text-sm text-gray-600 mt-1">
            Survival {Math.round(((evolution?.survival as number) ?? 0) * 100)}% · innovation{" "}
            {Math.round(((evolution?.innovation as number) ?? 0) * 100)}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Institution matrix</p>
          <p className="text-sm text-gray-600">
            Effectiveness{" "}
            {Math.round(
              ((civilization?.institutions as Record<string, unknown>)?.institutionEffectiveness as number) * 100,
            )}
            %
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Resilience radar</p>
          <p className="text-lg font-light">
            {(resilience?.resilienceScore as number) ?? (civilization?.resilienceDetail as Record<string, unknown>)?.resilienceScore ?? "—"}
            /100
          </p>
        </div>
        {view === "forecast" && (
          <div className="rounded-xl border border-gray-200 p-5 sm:col-span-2">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Long-horizon forecast</p>
            <ul className="text-sm space-y-1">
              {horizons.map((h) => (
                <li key={String(h.horizonYears)} className="flex justify-between">
                  <span>{String(h.horizonYears)} years</span>
                  <span className="text-gray-500 capitalize">
                    {String(h.trajectory)} · {Math.round((h.confidence as number) * 100)}% conf
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-light mb-3">Civilization history</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            {history.map((h) => (
              <li key={h.civilizationId}>
                {h.civilizationId.slice(0, 8)} · {h.name} · resilience {Math.round(h.resilience * 100)}% ·{" "}
                {h.trajectory}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
