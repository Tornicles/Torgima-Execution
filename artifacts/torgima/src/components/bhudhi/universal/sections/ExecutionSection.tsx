import { useCallback, useEffect, useState } from "react";
import { fetchKernelContext, fetchKernelEvents } from "@/lib/bhudhi-kernel-api";
import {
  fetchIntelligenceNextTask,
  intelligencePath,
  runIntelligenceKernelCycle,
} from "@/lib/intelligence-bridge";
import {
  fetchExecutionHistory,
  fetchExecutionStats,
  runUnifiedExecution,
  type ExecutionType,
} from "@/lib/bhudhi-runtime-api";
import { Link } from "wouter";

export function ExecutionSection({ blueprintId }: { blueprintId: string }) {
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [nextTask, setNextTask] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    successful: number;
    successRate: string;
    byType: Record<string, number>;
  } | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuntime = useCallback(async () => {
    if (!blueprintId) return;
    const [s, h] = await Promise.all([
      fetchExecutionStats(blueprintId),
      fetchExecutionHistory(blueprintId),
    ]);
    setStats(s.stats);
    setHistory(h.executions);
  }, [blueprintId]);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const cycle = await runIntelligenceKernelCycle(blueprintId);
      const ctx = await fetchKernelContext(blueprintId);
      setContext(ctx.context);
      const ev = await fetchKernelEvents(blueprintId, cycle.chainId);
      setEvents(ev.events);
      const nextOrderRec = await fetchIntelligenceNextTask(blueprintId);
      setNextTask(nextOrderRec as Record<string, unknown> | null);
      await loadRuntime();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load execution");
    } finally {
      setLoading(false);
    }
  }, [blueprintId, loadRuntime]);

  useEffect(() => {
    if (!blueprintId) return;
    void fetchKernelContext(blueprintId)
      .then((r) => setContext(r.context))
      .catch(() => {});
    void loadRuntime().catch(() => {});
  }, [blueprintId, loadRuntime]);

  async function runSample(type: ExecutionType) {
    if (!blueprintId) return;
    setLoading(true);
    try {
      const payloads: Record<ExecutionType, Record<string, unknown>> = {
        task: { title: "Sample order", status: "completed" },
        simulation: { name: "Quick sim", iterations: 3, goal: "Validate path" },
        team: { name: "Core team", members: [{ userId: "lead-1" }] },
        organization: { name: "Unit", projects: [{ id: "p1", name: "Initiative" }] },
        decision: { title: "Sample decision", id: "decision-sample" },
      };
      await runUnifiedExecution(blueprintId, type, payloads[type]);
      await loadRuntime();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Runtime execution failed");
    } finally {
      setLoading(false);
    }
  }

  const ctx = context as {
    domain?: string;
    phase?: string;
    signal?: string;
    condition?: string;
    execution?: Record<string, unknown>;
  } | null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">Execution</h1>
          <p className="text-gray-600">Unified runtime — kernel, Orders, and all execution types</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="text-sm underline text-gray-600"
        >
          {loading ? "Running…" : "Run kernel cycle"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500">Total runs</div>
            <div className="text-2xl font-light">{stats.total}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500">Successful</div>
            <div className="text-2xl font-light">{stats.successful}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500">Success rate</div>
            <div className="text-2xl font-light">{stats.successRate}</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
            {Object.entries(stats.byType).map(([t, n]) => (
              <div key={t} className="flex justify-between">
                <span className="capitalize">{t}</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {(["ta" + "sk", "simulation", "team", "organization", "decision"] as ExecutionType[]).map(
          (type) => (
            <button
              key={type}
              type="button"
              onClick={() => void runSample(type)}
              disabled={loading}
              className="border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-50 capitalize"
            >
              Run {type}
            </button>
          ),
        )}
      </div>

      {ctx && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Shared context</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Domain</div>
              <div className="font-medium">{ctx.domain ?? "—"}</div>
            </div>
            <div>
              <div className="text-gray-600">Phase</div>
              <div className="font-medium">{ctx.phase ?? "—"}</div>
            </div>
            <div>
              <div className="text-gray-600">Signal</div>
              <div className="font-medium">{ctx.signal ?? "—"}</div>
            </div>
            <div>
              <div className="text-gray-600">Condition</div>
              <div className="font-medium">{ctx.condition ?? "—"}</div>
            </div>
          </div>
        </div>
      )}

      {nextTask && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-2">Next Order</h2>
          <p className="font-medium">{String(nextTask.nextTask ?? "—")}</p>
          {typeof nextTask.description === "string" && nextTask.description.length > 0 && (
            <p className="text-sm text-gray-600 mt-2">{nextTask.description}</p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">Runtime history</h2>
          <ul className="space-y-2 text-sm">
            {history.slice(0, 10).map((ex) => (
              <li key={String(ex.executionId)} className="border border-gray-100 rounded p-3">
                <span className="font-mono text-xs text-gray-500">{String(ex.executionId)}</span>
                <p>
                  <span className="capitalize">{String(ex.executionType)}</span> ·{" "}
                  <span>{String(ex.status)}</span> · {Number(ex.progress)}%
                </p>
                <p className="text-gray-600 text-xs">{String(ex.action)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {events.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">Recent kernel events</h2>
          <ul className="space-y-2 text-sm">
            {events.slice(0, 8).map((e) => (
              <li key={String(e.id)} className="font-mono text-xs border-l-2 border-gray-300 pl-3 py-1">
                {String(e.event_type ?? e.eventType)} · {String(e.source_engine ?? e.sourceEngine)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-gray-500">
        <Link href={intelligencePath("protocol", blueprintId)} className="underline">
          Protocol
        </Link>{" "}
        and kernel cycle steps are recorded as BHUDHI:// messages.
      </p>
    </div>
  );
}
