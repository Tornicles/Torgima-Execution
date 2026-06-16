import { useCallback, useEffect, useState } from "react";
import { INTELLIGENCE_COPY } from "@/lib/language-map";
import {
  executeConvergenceGoal,
  fetchConvergenceState,
  submitConvergenceFeedback,
  type ConvergenceUnifiedState,
} from "@/lib/torgima-bhudhi-api";

export function ConvergenceSection({ blueprintId }: { blueprintId: string }) {
  const [state, setState] = useState<ConvergenceUnifiedState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExecute, setLastExecute] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    if (!blueprintId) return;
    setError(null);
    try {
      const s = await fetchConvergenceState(blueprintId);
      setState(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load convergence state");
    }
  }, [blueprintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runExecute = async (createOrder: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await executeConvergenceGoal(blueprintId, { createOrder });
      setLastExecute(res.result ?? res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setLoading(false);
    }
  };

  const runFeedback = async () => {
    if (!state?.currentOrder?.id) return;
    setLoading(true);
    try {
      await submitConvergenceFeedback(blueprintId, state.currentOrder.id, {
        completed: true,
        score: 90,
        reflection: "Completed via convergence dashboard",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feedback failed");
    } finally {
      setLoading(false);
    }
  };

  if (!state && !error) {
    return <p className="text-sm text-gray-500">Loading unified state…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-light mb-2">{INTELLIGENCE_COPY.convergenceTitle}</h1>
        <p className="text-gray-600 text-sm">{INTELLIGENCE_COPY.convergenceBody}</p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {state && (
        <>
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Active goal (Torgima)</h2>
            <p className="text-xl font-light">{state.blueprint.goal}</p>
            <p className="text-sm text-gray-600 mt-2">
              Signal: <span className="font-medium">{state.bhudhi.signal}</span> · Control:{" "}
              <span className="font-medium">{state.bhudhi.control}</span>
            </p>
          </div>

          {state.currentOrder && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Current order</h2>
              <p className="font-medium">{state.currentOrder.instruction}</p>
              <p className="text-sm text-gray-600 mt-2">{state.currentOrder.expectedOutput}</p>
              <p className="text-xs text-gray-500 mt-1">Status: {state.currentOrder.status}</p>
            </div>
          )}

          <div className="border border-purple-200 bg-purple-50 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">{INTELLIGENCE_COPY.guidanceHeading}</h2>
            <p className="text-sm">
              {state.bhudhi.recommendation ?? "Run execute to generate recommendations from kernel cycle"}
            </p>
            {state.bhudhi.confidence != null && (
              <p className="text-sm mt-2">Confidence: {(state.bhudhi.confidence * 100).toFixed(0)}%</p>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">System flow</h2>
            <ol className="text-sm space-y-2 list-decimal list-inside text-gray-700">
              <li>Torgima: goal → blueprint → order</li>
              <li>Convergence: map blueprint & sync orders</li>
              <li>{INTELLIGENCE_COPY.convergenceFlow}</li>
              <li>Feedback loop: complete order → learn → next cycle</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void runExecute(false)}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {INTELLIGENCE_COPY.runCycle}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runExecute(true)}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Cycle + create pending order
            </button>
            {state.currentOrder && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void runFeedback()}
                className="px-5 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 disabled:opacity-50"
              >
                Submit feedback & re-cycle
              </button>
            )}
          </div>

          {lastExecute && (
            <div className="border border-gray-200 rounded-lg p-4 text-xs font-mono overflow-auto max-h-48">
              <pre>{JSON.stringify(lastExecute, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
