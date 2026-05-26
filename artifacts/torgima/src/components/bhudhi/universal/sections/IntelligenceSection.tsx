import { useEffect, useState } from "react";
import {
  fetchBhudhiInsights,
  fetchBhudhiRecommendations,
  generateBhudhiRecommendations,
  runBhudhiInvestigate,
} from "@/lib/bhudhi-api";
import type { BhudhiRecommendation } from "@/lib/bhudhi-api";

export function IntelligenceSection({ blueprintId }: { blueprintId: string }) {
  const [recommendations, setRecommendations] = useState<BhudhiRecommendation[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const [recs, ins] = await Promise.all([
        fetchBhudhiRecommendations(blueprintId),
        fetchBhudhiInsights(blueprintId),
      ]);
      setRecommendations(recs?.recommendations ?? []);
      setInsights(ins?.insights ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load intelligence");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [blueprintId]);

  async function runAction(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">Intelligence</h1>
          <p className="text-gray-600">Investigations and recommendations</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button
            type="button"
            className="underline text-gray-600"
            disabled={!!busy}
            onClick={() => void runAction("investigate", () => runBhudhiInvestigate(blueprintId))}
          >
            Investigate
          </button>
          <button
            type="button"
            className="underline text-gray-600"
            disabled={!!busy}
            onClick={() => void runAction("recommend", () => generateBhudhiRecommendations(blueprintId))}
          >
            Generate recommendations
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Recommendations</h2>
          {recommendations.slice(0, 8).map((rec) => (
            <div key={rec.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium">{rec.title}</div>
                <div className="text-sm text-gray-600">{(rec.confidence * 100).toFixed(0)}%</div>
              </div>
              <p className="text-sm text-gray-600">{rec.description}</p>
            </div>
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Insights</h2>
          {insights.slice(0, 8).map((insight, i) => (
            <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
              <p className="text-sm">{insight}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && recommendations.length === 0 && insights.length === 0 && (
        <p className="text-sm text-gray-500">No recommendations yet. Run investigate or generate.</p>
      )}
    </div>
  );
}
