import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  fetchEconomicsForecast,
  fetchEconomicsModels,
  fetchEconomicsOverview,
} from "@/lib/bhudhi-economics-api";

type EcoView =
  | "overview"
  | "models"
  | "budget"
  | "confidence"
  | "memory"
  | "simulation"
  | "optimization"
  | "forecast"
  | "incidents";

const VIEWS: { id: EcoView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "models", label: "Models" },
  { id: "budget", label: "Budget" },
  { id: "forecast", label: "Forecast" },
  { id: "optimization", label: "Optimization" },
  { id: "confidence", label: "Confidence" },
  { id: "memory", label: "Memory" },
  { id: "simulation", label: "Simulation" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiEconomicsPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const storeBlueprintId = useBlueprintStore((s) => s.activeBlueprintId);
  const blueprintId = blueprintIdFromSearch(search) ?? storeBlueprintId ?? "";

  const [view, setView] = useState<EcoView>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchEconomicsOverview>> | null>(null);
  const [models, setModels] = useState<Array<{ modelId: string; valueScore: number; provider?: string }>>([]);
  const [forecasts, setForecasts] = useState<Array<{ horizonDays: number; costUsd: number; tokens: number }>>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, md, fc] = await Promise.all([
        fetchEconomicsOverview(blueprintId || undefined),
        fetchEconomicsModels(),
        fetchEconomicsForecast(blueprintId || undefined),
      ]);
      setOverview(ov);
      setModels(md.models as Array<{ modelId: string; valueScore: number; provider?: string }>);
      setForecasts(fc.forecasts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load economics");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10">
      <header className="mb-8 flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">BIEE</p>
          <h1 className="text-3xl font-light">Intelligence Economics</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-xl">
            Bhudhi does not become smarter by spending more — it optimizes intelligence per unit of cost.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void reload()} className="text-sm text-gray-600 underline">
            {loading ? "Refreshing…" : "Refresh"}
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

      {view === "overview" && overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Cost / request</div>
            <div className="text-2xl font-light mt-2">
              ${Number((overview.metrics as { costPerRequest?: number }).costPerRequest ?? 0).toFixed(4)}
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Daily budget</div>
            <div className="text-2xl font-light mt-2">
              ${Number(overview.profile.dailyUsdBudget ?? 5).toFixed(2)}
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Cache hit</div>
            <div className="text-2xl font-light mt-2">
              {Math.round(
                Number((overview.metrics as { cacheHitRate?: number }).cacheHitRate ?? 0) * 100,
              )}
              %
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Avg value score</div>
            <div className="text-2xl font-light mt-2">
              {Number((overview.metrics as { avgValueScore?: number }).avgValueScore ?? 0).toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {view === "models" && (
        <div className="space-y-2">
          {models.map((m) => (
            <div key={m.modelId} className="border border-gray-100 rounded-lg p-4 flex justify-between text-sm">
              <span className="font-medium">{m.modelId}</span>
              <span className="text-gray-500">value {m.valueScore.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {view === "budget" && overview && (
        <div className="border border-gray-200 rounded-xl p-6 text-sm space-y-2">
          <p>Token budget: {String(overview.profile.dailyTokenBudget ?? 100000)}</p>
          <p>Target confidence: {Math.round(Number(overview.profile.targetConfidence ?? 0.8) * 100)}%</p>
          <p>Execution mode: {String(overview.profile.executionMode ?? "STANDARD")}</p>
        </div>
      )}

      {view === "forecast" && (
        <div className="space-y-2">
          {forecasts.map((f) => (
            <div key={f.horizonDays} className="border border-gray-100 rounded-lg p-3 flex justify-between text-sm">
              <span>{f.horizonDays} day horizon</span>
              <span>
                ${f.costUsd.toFixed(2)} · {f.tokens.toLocaleString()} tokens
              </span>
            </div>
          ))}
        </div>
      )}

      {view === "optimization" && overview && (
        <ul className="space-y-2 text-sm">
          {(overview.optimizationProposals ?? []).length === 0 ? (
            <li className="text-gray-500">No optimization proposals — routing is efficient.</li>
          ) : (
            overview.optimizationProposals.map((p) => (
              <li key={p.id} className="border border-amber-100 bg-amber-50 rounded-lg p-3">
                {p.description}
              </li>
            ))
          )}
        </ul>
      )}

      {(view === "confidence" || view === "memory" || view === "simulation") && (
        <p className="text-sm text-gray-600">
          {view === "confidence" && "Higher confidence tiers require more memory, validation, and compute."}
          {view === "memory" && "Memory tiers: HOT → WARM → COLD → ARCHIVE. Signals and governance are protected."}
          {view === "simulation" && "Simulation scales by FAST / NORMAL / STRATEGIC / FULL WORLD based on value ratio."}
        </p>
      )}
    </div>
  );
}
