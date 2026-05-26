import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  checkBhudhiReliability,
  fetchReliabilityHealth,
  fetchReliabilityHistory,
} from "@/lib/bhudhi-reliability-api";

type View = "health" | "incidents" | "recovery" | "chaos" | "continuity" | "observability";

const VIEWS: { id: View; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "incidents", label: "Incidents" },
  { id: "recovery", label: "Recovery" },
  { id: "chaos", label: "Chaos" },
  { id: "continuity", label: "Continuity" },
  { id: "observability", label: "Observability" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiReliabilityPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("health");
  const [reliability, setReliability] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; health: number; risk: number; failureProbability: number; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const checked = await checkBhudhiReliability(blueprintId);
      setReliability(checked.reliability);
      await fetchReliabilityHealth(blueprintId);
      const h = await fetchReliabilityHistory(blueprintId);
      setHistory(h.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reliability");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const incidents = (reliability?.incidents as Array<{ incident: string; severity: string }>) ?? [];
  const containment = (reliability?.containment as Array<{ action: string; target: string }>) ?? [];

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BRE</p>
        <h1 className="text-3xl font-light">Reliability</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi is reliable because failure never becomes collapse — prevent, detect, contain, recover,
          strengthen.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Run check"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {reliability && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Reliability pulse</p>
          <p className="text-lg font-light">{String(reliability.recommendedProtection ?? "")}</p>
          <p className="text-sm text-gray-600 mt-2">
            Health {Math.round(Number(reliability.health ?? 0) * 100)}% · Resilience{" "}
            {String(reliability.resilienceScore ?? "—")}/100 · {String(reliability.continuityMode ?? "ONLINE")}
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

      {view === "health" && reliability && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Stress graph</h2>
          <p className="text-sm">
            Risk {Math.round(Number(reliability.risk ?? 0) * 100)}% · P(fail){" "}
            {Math.round(Number(reliability.failureProbability ?? 0) * 100)}%
          </p>
        </section>
      )}

      {view === "incidents" && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Incident timeline</h2>
          <ul className="space-y-2 text-sm">
            {incidents.map((i, idx) => (
              <li key={idx} className="flex justify-between border-b border-gray-100 pb-2">
                <span>{i.incident}</span>
                <span className="text-gray-500">{i.severity}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "recovery" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Recovery map — POST /api/bhudhi/reliability/recover for strategy, confidence, and ETA.
        </section>
      )}

      {view === "chaos" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Chaos modes: SAFE, LAB, STAGING, DISABLED. Never production without governance approval.
        </section>
      )}

      {view === "continuity" && reliability && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light">{String(reliability.continuityMode)}</h2>
          <p className="text-sm text-gray-600 mt-2">Execution, memory, decision, and state continuity tracked.</p>
        </section>
      )}

      {view === "observability" && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">Containment</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            {containment.map((c, i) => (
              <li key={i}>
                {c.action} → {c.target}
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10 rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">History</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="text-gray-500">
                {h.createdAt?.slice(0, 16)} — health {Math.round(h.health * 100)}%
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
