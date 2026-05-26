import { useCallback, useEffect, useState } from "react";
import {
  fetchBhudhiMonitoringHealth,
  fetchBhudhiMonitoringMetrics,
  fetchPlatformHealth,
  type BhudhiMonitoringHealth,
  type BhudhiMonitoringMetrics,
} from "@/lib/bhudhi-monitoring-api";

function statusBorder(status: string | undefined): string {
  if (status === "healthy") return "border-green-200 bg-green-50";
  if (status === "degraded") return "border-yellow-200 bg-yellow-50";
  return "border-red-200 bg-red-50";
}

export function MonitoringSection({ blueprintId }: { blueprintId: string }) {
  const [health, setHealth] = useState<BhudhiMonitoringHealth | null>(null);
  const [platformHealth, setPlatformHealth] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<BhudhiMonitoringMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [h, p, m] = await Promise.all([
        fetchBhudhiMonitoringHealth(),
        fetchPlatformHealth(),
        fetchBhudhiMonitoringMetrics(),
      ]);
      setHealth(h);
      setPlatformHealth(p);
      setMetrics(m.metrics ?? m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load monitoring");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  if (!health && !metrics && !error) {
    return <p className="text-sm text-gray-500">Loading monitoring…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-light mb-2">Monitoring</h1>
        <p className="text-gray-600 text-sm">
          Production health for Bhudhi layers and platform API
          {blueprintId ? ` · blueprint ${blueprintId.slice(0, 8)}…` : ""}
        </p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      <div className={`border rounded-lg p-6 ${statusBorder(health?.status)}`}>
        <h2 className="text-lg font-medium mb-4">Bhudhi layer health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Status</div>
            <div className="text-2xl font-light capitalize">{health?.status ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-600">Version</div>
            <div className="font-mono text-xs">{health?.version ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-600">Updated</div>
            <div className="font-mono text-xs">
              {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "—"}
            </div>
          </div>
        </div>
      </div>

      {platformHealth && (
        <div className={`border rounded-lg p-6 ${statusBorder(String(platformHealth.status ?? ""))}`}>
          <h2 className="text-lg font-medium mb-4">Platform API</h2>
          <p className="text-sm text-gray-600 capitalize">
            {String(platformHealth.status ?? "unknown")} · GET /api/health
          </p>
        </div>
      )}

      {health?.latencies && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Latencies (ms)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {Object.entries(health.latencies).map(([key, value]) => (
              <div key={key}>
                <div className="text-gray-600 capitalize">{key}</div>
                <div className="text-2xl font-light">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {health?.checks && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Component checks</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(health.checks).map(([key, ok]) => (
              <li key={key} className="flex justify-between">
                <span className="capitalize">{key}</span>
                <span className={ok ? "text-green-600" : "text-red-600"}>{ok ? "✓" : "✗"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {metrics?.bhudhi && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Bhudhi metrics (24h)</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-600">Kernel events</dt>
              <dd className="text-xl font-light">{metrics.bhudhi.kernelEventsLast24h ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Protocol messages</dt>
              <dd className="text-xl font-light">{metrics.bhudhi.protocolMessagesLast24h ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Memory nodes</dt>
              <dd className="text-xl font-light">{metrics.bhudhi.memoryNodes ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Executions</dt>
              <dd className="text-xl font-light">{metrics.bhudhi.executionsLast24h ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Runtime success %</dt>
              <dd className="text-xl font-light">{metrics.bhudhi.runtimeSuccessRate ?? "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      {health?.errors && health.errors.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Errors</h2>
          <ul className="space-y-1 text-sm text-red-700">
            {health.errors.map((msg, i) => (
              <li key={i}>• {msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
