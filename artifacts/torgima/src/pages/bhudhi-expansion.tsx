import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  benchmarkExpansion,
  discoverExpansion,
  evaluateExpansion,
  fetchExpansionHistory,
} from "@/lib/bhudhi-expansion-api";

type View = "capabilities" | "growth" | "benchmarks" | "risk" | "approvals" | "history";

const VIEWS: { id: View; label: string }[] = [
  { id: "capabilities", label: "Capabilities" },
  { id: "growth", label: "Growth" },
  { id: "benchmarks", label: "Benchmarks" },
  { id: "risk", label: "Risk" },
  { id: "approvals", label: "Approvals" },
  { id: "history", label: "History" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiExpansionPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("capabilities");
  const [expansion, setExpansion] = useState<Record<string, unknown> | null>(null);
  const [benchmark, setBenchmark] = useState<Record<string, unknown> | null>(null);
  const [capabilities, setCapabilities] = useState<
    Array<{ capabilityId: string; capabilityKey: string; status: string; score: number; risk: number }>
  >([]);
  const [history, setHistory] = useState<Array<{ action: string; capabilityKey: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const discovered = await discoverExpansion(blueprintId);
      setExpansion(discovered.expansion);
      await evaluateExpansion(blueprintId);
      const bench = await benchmarkExpansion(blueprintId);
      setBenchmark(bench.benchmark);
      const hist = await fetchExpansionHistory(blueprintId);
      setCapabilities(hist.capabilities);
      setHistory(hist.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load expansion intelligence");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const newCapabilities = (expansion?.newCapabilities as Array<Record<string, unknown>>) ?? [];
  const evaluation = expansion?.evaluation as Record<string, unknown> | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BAEE</p>
        <h1 className="text-3xl font-light">AGI Expansion</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Controlled capability expansion — discover, generalize, compose, evaluate, govern. Expansion never
          bypasses governance.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Discover capabilities"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {expansion && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Expansion status</p>
          <p className="text-2xl font-light">
            {expansion.approval ? "Governance approved" : "Pending approval"} · risk{" "}
            {Math.round((expansion.risk as number) * 100)}%
          </p>
          <p className="text-sm text-gray-600 mt-2">{String(expansion.recommendation ?? "")}</p>
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
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Capability graph</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {newCapabilities.slice(0, 6).map((c, i) => (
              <li key={i}>
                {String(c.capability)} · score {Math.round((c.score as number) * 100)}%
              </li>
            ))}
            {newCapabilities.length === 0 && <li>No candidates yet</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Expansion curve</p>
          <p className="text-lg font-light">
            Confidence {Math.round((expansion?.confidence as number) * 100)}%
          </p>
          <p className="text-sm text-gray-600 mt-1 capitalize">Action: {String(evaluation?.action ?? "—")}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Benchmark matrix</p>
          {benchmark ? (
            <ul className="text-sm text-gray-600">
              <li>Gain {Math.round((benchmark.gain as number) * 100)}%</li>
              <li>Cost {Math.round((benchmark.cost as number) * 100)}%</li>
              <li>Confidence {Math.round((benchmark.confidence as number) * 100)}%</li>
            </ul>
          ) : (
            <p className="text-sm text-gray-600">No benchmark — no promotion</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Promotion queue</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {capabilities
              .filter((c) => c.status === "candidate" || c.status === "evaluated")
              .slice(0, 5)
              .map((c) => (
                <li key={c.capabilityId}>
                  {c.capabilityKey.slice(0, 24)} · {c.status}
                </li>
              ))}
            {capabilities.length === 0 && <li>Queue empty</li>}
          </ul>
        </div>
      </div>

      {view === "history" && history.length > 0 && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-light mb-3">Expansion history</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            {history.map((h, i) => (
              <li key={i}>
                {h.action} · {h.capabilityKey ?? "—"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
