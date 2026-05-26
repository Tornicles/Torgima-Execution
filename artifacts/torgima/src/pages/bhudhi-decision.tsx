import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { fetchDecisionHistory, replayBhudhiDecision } from "@/lib/bhudhi-decision-api";

type View = "live" | "history" | "replay" | "confidence" | "tradeoffs";

const VIEWS: { id: View; label: string }[] = [
  { id: "live", label: "Live decisions" },
  { id: "history", label: "History" },
  { id: "replay", label: "Replay" },
  { id: "confidence", label: "Confidence" },
  { id: "tradeoffs", label: "Tradeoffs" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiDecisionPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("live");
  const [history, setHistory] = useState<
    Array<{ decisionId: string; goal: string; confidence: number; status: string; selected?: string }>
  >([]);
  const [replay, setReplay] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const h = await fetchDecisionHistory(blueprintId);
      setHistory(h.decisions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runReplay(decisionId: string) {
    try {
      const r = await replayBhudhiDecision(decisionId);
      setReplay(r.replay);
      setView("replay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Replay failed");
    }
  }

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BDIE</p>
        <h1 className="text-3xl font-light">Decision Intelligence</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi executes because it decided — and can explain why. Every option traceable. Governance preserved.
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

      {(view === "live" || view === "history") && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">
              No decisions yet. Execution creates decisions automatically via the operating pipeline.
            </p>
          ) : (
            history.map((d) => (
              <div key={d.decisionId} className="border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm">{d.goal}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {d.selected} · {Math.round(d.confidence * 100)}% confidence · {d.status}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[var(--torgima-primary)] underline shrink-0"
                    onClick={() => void runReplay(d.decisionId)}
                  >
                    Replay
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {view === "replay" && replay && (
        <div className="border border-gray-200 rounded-xl p-6 space-y-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 uppercase">What happened</div>
            <p className="mt-1">{String(replay.whatHappened ?? "")}</p>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">What should happen</div>
            <p className="mt-1">{String(replay.whatShouldHappen ?? "")}</p>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">What would happen</div>
            <p className="mt-1">{String(replay.whatWouldHappen ?? "")}</p>
          </div>
        </div>
      )}

      {view === "confidence" && (
        <p className="text-sm text-gray-600">
          Confidence cannot exceed evidence. Dimensions: data, simulation, memory, agreement, evidence. Levels: LOW →
          CERTAIN.
        </p>
      )}

      {view === "tradeoffs" && (
        <p className="text-sm text-gray-600">
          Tradeoff matrix evaluates time, money, complexity, life impact, confidence, execution effort, risk, and
          learning value for each option.
        </p>
      )}
    </div>
  );
}
