import { useEffect, useState } from "react";
import { fetchAdminSystemHealth } from "@/admin/api/adminClient";
import { StatusBadge } from "@/admin/components/StatusBadge";

export default function AdminSystemHealthPage() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const load = () => void fetchAdminSystemHealth().then(setHealth).catch(() => null);
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!health) return <p className="text-slate-400">Loading health…</p>;

  const metrics = health.metrics as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">System health</h2>
      <div className="flex flex-wrap gap-3">
        <StatusBadge ok={health.database === "connected"} label="Database" />
        <StatusBadge ok={Number(health.stuckEvents) === 0} label="Stuck events" />
        <StatusBadge ok={Number(health.deadLetterCount) === 0} label="Dead letter" />
      </div>
      <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
        <div className="rounded-xl border border-slate-800 p-4">
          <p>Pending events: {String(health.workerQueueDepth ?? metrics?.pending_event_count ?? 0)}</p>
          <p className="mt-2">DLQ count: {String(health.deadLetterCount ?? 0)}</p>
          <p className="mt-2">Bhudhi last: {String(health.bhudhiLastStatus ?? "—")}</p>
        </div>
        <div className="rounded-xl border border-slate-800 p-4">
          <p>Latency p50: {String(metrics?.event_processing_latency_ms_p50 ?? "—")} ms</p>
          <p className="mt-2">Guarantee misses 24h: {String(metrics?.task_guarantee_miss_count_24h ?? 0)}</p>
          <p className="mt-2">EIS cost/day: ${String(metrics?.eis_cost_per_day_usd ?? 0)}</p>
        </div>
      </div>
    </div>
  );
}
