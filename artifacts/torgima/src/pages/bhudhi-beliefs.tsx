import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { fetchBeliefHistory } from "@/lib/bhudhi-belief-api";

type View = "facts" | "beliefs" | "hypotheses" | "truth" | "conflicts" | "drift" | "evolution";

const VIEWS: { id: View; label: string }[] = [
  { id: "facts", label: "Facts" },
  { id: "beliefs", label: "Beliefs" },
  { id: "hypotheses", label: "Hypotheses" },
  { id: "truth", label: "Truth" },
  { id: "conflicts", label: "Conflicts" },
  { id: "drift", label: "Drift" },
  { id: "evolution", label: "Evolution" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiBeliefsPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("facts");
  const [history, setHistory] = useState<
    Array<{ beliefId: string; type: string; statement: string; state: string; confidence: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const h = await fetchBeliefHistory(blueprintId);
      setHistory(h.beliefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load beliefs");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = history.filter((b) => {
    if (view === "facts") return b.type === "fact";
    if (view === "beliefs") return b.type === "belief";
    if (view === "hypotheses") return b.type === "hypothesis";
    return true;
  });

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BBAE</p>
        <h1 className="text-3xl font-light">Belief Architecture</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi believes because evidence survived challenge — not because it remembers. Truth, assumption, and
          hypothesis are formally separated.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
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

      {view === "truth" && (
        <p className="text-sm text-gray-600 mb-4">
          Truth expires. Categories: LOCAL, GLOBAL, TEMPORARY, PERMANENT. Facts require evidence; nothing becomes fact
          automatically.
        </p>
      )}

      {view === "drift" && (
        <p className="text-sm text-gray-600 mb-4">
          Drift monitors truth erosion, hallucination, bias, and memory pollution. Actions: revalidation, rollback,
          governance.
        </p>
      )}

      {view === "conflicts" && (
        <p className="text-sm text-gray-600 mb-4">
          Contradictions trigger freeze, investigate, escalate, or resolve. Unknown remains visible.
        </p>
      )}

      {view === "evolution" && (
        <p className="text-sm text-gray-600 mb-4">
          Lifecycle: create → challenge → validate → replace. Evidence must survive challenge before validation.
        </p>
      )}

      {(view === "facts" || view === "beliefs" || view === "hypotheses" || filtered.length > 0) && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500">
              No beliefs yet. Bhudhi forms beliefs automatically during intelligence calls (after memory retrieval).
            </p>
          ) : (
            filtered.map((b) => (
              <div key={b.beliefId} className="border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase">
                  {b.type} · {b.state} · {Math.round(b.confidence * 100)}%
                </div>
                <div className="font-medium text-sm mt-1">{b.statement}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
