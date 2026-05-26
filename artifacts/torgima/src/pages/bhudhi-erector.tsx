import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  compareSimulations,
  createBhudhiSimulation,
  fetchSimulationHistory,
  runBhudhiSimulation,
} from "@/lib/bhudhi-erector-api";

type View = "world" | "scenarios" | "actors" | "economy" | "execution" | "outcomes";

const VIEWS: { id: View; label: string }[] = [
  { id: "world", label: "World" },
  { id: "scenarios", label: "Scenarios" },
  { id: "actors", label: "Actors" },
  { id: "economy", label: "Economy" },
  { id: "execution", label: "Execution" },
  { id: "outcomes", label: "Outcomes" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiErectorPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("world");
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);
  const [comparison, setComparison] = useState<{
    runs: Array<{ simulationId: string; overall: number; recommendation: string }>;
    winner: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{ simulationId: string; goal: string | null; confidence: number; recommendation: string | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createBhudhiSimulation(blueprintId, "Blueprint execution");
      setSimulation(created.simulation);
      const cmp = await compareSimulations(blueprintId);
      setComparison(cmp.comparison);
      const hist = await fetchSimulationHistory(blueprintId);
      setHistory(hist.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load erector runtime");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const scenarios = (simulation?.scenarios as Array<Record<string, unknown>>) ?? [];
  const outcomes = simulation?.outcomes as Record<string, unknown> | undefined;
  const score = simulation?.score as Record<string, unknown> | undefined;
  const events = (outcomes?.events as Array<Record<string, unknown>>) ?? [];

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BERE</p>
        <h1 className="text-3xl font-light">Erector Runtime</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Synthetic reality execution — construct worlds, inject variables, run reality, measure outcomes.
          Simulation informs reality; it never replaces it.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Construct world"}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!blueprintId) return;
              const r = await runBhudhiSimulation(blueprintId, "stress");
              setSimulation(r.simulation);
            }}
            className="text-sm underline text-gray-600"
          >
            Run stress scenario
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {simulation && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Simulation confidence</p>
          <p className="text-2xl font-light">{Math.round((simulation.confidence as number) * 100)}%</p>
          <p className="text-sm text-gray-600 mt-2">{String(simulation.recommendation ?? "")}</p>
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
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">World map</p>
          <p className="text-sm text-gray-600">
            {view === "world" ? "Constructed market · organization · resources" : "Select World view"}
          </p>
          {score && (
            <p className="mt-2 text-lg font-light">Overall {String(score.overall)}/100</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Pressure graph</p>
          <p className="text-lg font-light">{outcomes ? `${Math.round((outcomes.pressure as number) * 100)}%` : "—"}</p>
          <p className="text-sm text-gray-600 mt-1">
            {outcomes?.survived ? "Survived pressure" : "Pressure exceeded threshold"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 sm:col-span-2">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Scenario radar</p>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {scenarios.map((s) => (
              <li key={String(s.scenario)} className="flex justify-between border-b border-gray-100 py-1">
                <span className="capitalize">{String(s.scenario)}</span>
                <span className="text-gray-500">
                  P {Math.round((s.probability as number) * 100)}% · risk {Math.round((s.risk as number) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 sm:col-span-2">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Outcome tree</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {events.slice(0, 8).map((e, i) => (
              <li key={i}>
                t{String(e.at)} · {String(e.type)} — {String(e.detail)}
              </li>
            ))}
            {events.length === 0 && <li>No events yet — run simulation</li>}
          </ul>
        </div>
      </div>

      {view === "outcomes" && comparison && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-light mb-3">Comparable runs</h2>
          <ul className="text-sm space-y-2">
            {comparison.runs.map((r) => (
              <li key={r.simulationId} className={r.simulationId === comparison.winner ? "font-medium" : ""}>
                {r.simulationId.slice(0, 8)} — {r.overall}/100 — {r.recommendation.slice(0, 60)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-8 rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-light mb-3">Simulation history</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            {history.map((h) => (
              <li key={h.simulationId}>
                {h.simulationId.slice(0, 8)} · {h.goal ?? "—"} · conf {Math.round(h.confidence * 100)}%
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
