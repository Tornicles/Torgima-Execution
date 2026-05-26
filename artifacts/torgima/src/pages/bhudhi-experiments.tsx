import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { createBhudhiExperiment, fetchExperimentHistory } from "@/lib/bhudhi-experiment-api";

type View = "live" | "hypotheses" | "results" | "comparison" | "promotion" | "failures";

const VIEWS: { id: View; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "hypotheses", label: "Hypotheses" },
  { id: "results", label: "Results" },
  { id: "comparison", label: "Comparison" },
  { id: "promotion", label: "Promotion" },
  { id: "failures", label: "Failures" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiExperimentsPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("live");
  const [experiment, setExperiment] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<{ experimentId: string; goal: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createBhudhiExperiment(blueprintId, "Validate execution improvement");
      setExperiment(created.experiment);
      const h = await fetchExperimentHistory(blueprintId);
      setHistory(h.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load experiments");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hypothesis = experiment?.hypothesis as Record<string, unknown> | undefined;
  const groups = experiment?.groups as Array<{ groupKey: string; label: string }> | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BEE</p>
        <h1 className="text-3xl font-light">Experimentation</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Nothing becomes permanent until tested. Bhudhi improves because reality repeated the result — not because
          something worked once.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "New experiment"}
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

      {view === "hypotheses" && hypothesis && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm space-y-2">
          <div className="font-medium">{String(hypothesis.claim ?? "")}</div>
          <div className="text-gray-600">{String(hypothesis.reason ?? "")}</div>
          <div>Expected: {String(hypothesis.expectedOutcome ?? "")}</div>
        </div>
      )}

      {view === "live" && groups && (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.groupKey} className="border border-gray-200 rounded-lg p-3 text-sm">
              <span className="text-xs text-gray-500 uppercase">{g.groupKey}</span>
              <div>{g.label}</div>
            </div>
          ))}
        </div>
      )}

      {(view === "results" || view === "comparison" || view === "promotion") && (
        <p className="text-sm text-gray-600">
          {view === "results" && "Measure impact, quality, speed, cost before interpretation."}
          {view === "comparison" && "Compare control vs variants — difference ≠ improvement."}
          {view === "promotion" && "Promote only with confidence, repeatability, stability, and governance."}
        </p>
      )}

      {view === "failures" && (
        <div className="text-sm text-gray-600">
          Archived failures remain in experiment memory for learning.
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8 space-y-2">
          <div className="text-xs text-gray-500 uppercase">History</div>
          {history.map((e) => (
            <div key={e.experimentId} className="border border-gray-100 rounded-lg p-2 text-sm">
              {e.goal} · {e.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
