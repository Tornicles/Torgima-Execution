import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  observeBhudhiInfrastructure,
  fetchInfrastructureHistory,
  scaleBhudhiInfrastructure,
} from "@/lib/bhudhi-infrastructure-api";

type View = "runtime" | "deployments" | "scaling" | "capacity" | "observability" | "recovery";

const VIEWS: { id: View; label: string }[] = [
  { id: "runtime", label: "Runtime" },
  { id: "deployments", label: "Deployments" },
  { id: "scaling", label: "Scaling" },
  { id: "capacity", label: "Capacity" },
  { id: "observability", label: "Observability" },
  { id: "recovery", label: "Recovery" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiInfrastructurePage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("runtime");
  const [infra, setInfra] = useState<Record<string, unknown> | null>(null);
  const [scale, setScale] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; environment: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const observed = await observeBhudhiInfrastructure(blueprintId);
      setInfra(observed.infrastructure);
      const sc = await scaleBhudhiInfrastructure(blueprintId);
      setScale(sc.scale);
      const h = await fetchInfrastructureHistory(blueprintId);
      setHistory(h.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load infrastructure");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runtime = infra?.runtime as Record<string, unknown> | undefined;
  const capacity = infra?.capacity as Record<string, unknown> | undefined;
  const deploymentPlan = infra?.deploymentPlan as Record<string, unknown> | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BIIE</p>
        <h1 className="text-3xl font-light">Infrastructure</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi scales because infrastructure becomes intelligent — observe, allocate, deploy, measure,
          optimize.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Observe infra"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {infra && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Runtime pulse</p>
          <p className="text-lg font-light">{String(infra.environment ?? "")}</p>
          <p className="text-sm text-gray-600 mt-2">
            Risk {Math.round(Number(infra.risk ?? 0) * 100)}% · Capacity{" "}
            {capacity?.canSupport ? "supported" : "constrained"}
          </p>
        </section>
      )}

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

      {view === "runtime" && runtime && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">{String(runtime.runtime)}</h2>
          <p className="text-sm text-gray-600">
            Health {Math.round(Number(runtime.health ?? 0) * 100)}% · Latency {String(runtime.latencyMs)}ms
          </p>
        </section>
      )}

      {view === "deployments" && deploymentPlan && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Deployment timeline</h2>
          <p className="text-sm">Strategy: {String(deploymentPlan.strategy)}</p>
          <ul className="mt-3 space-y-1 text-sm text-gray-600">
            {((deploymentPlan.steps as string[]) ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {view === "scaling" && scale && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">Capacity curve</h2>
          <p className="text-sm">
            Scale {String(scale.scale)} · Forecast {String(scale.forecast)} · Cost ~{String(scale.cost)}
          </p>
        </section>
      )}

      {view === "capacity" && capacity && (
        <section className="rounded-xl border p-6 text-sm">
          Utilization {Math.round(Number(capacity.utilization ?? 0) * 100)}% · Available{" "}
          {String(capacity.available)}
        </section>
      )}

      {view === "observability" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Live, hourly, daily, historical views — latency, availability, load, throughput, errors.
        </section>
      )}

      {view === "recovery" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Failover, reroute, rollback, rebuild — POST /api/bhudhi/infra/recover
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10 rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Infra map / history</h2>
          <ul className="space-y-2 text-sm text-gray-500">
            {history.map((h) => (
              <li key={h.id}>
                {h.createdAt?.slice(0, 16)} — {h.environment}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
