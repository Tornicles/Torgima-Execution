import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAdminDashboardOverview } from "@/admin/api/adminClient";
import { KPICard } from "@/admin/components/KPICard";
import { StatusBadge } from "@/admin/components/StatusBadge";

const CONDITION_COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#22c55e", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function AdminDashboardPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminDashboardOverview>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await fetchAdminDashboardOverview();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading dashboard…</p>;

  const h = data.health as Record<string, unknown>;
  const kpis = data.kpis as Record<string, number>;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-white">Organization overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard label="Total users" value={kpis.totalUsers ?? 0} />
        <KPICard label="DAU" value={kpis.dau ?? 0} />
        <KPICard label="MAU" value={kpis.mau ?? 0} />
        <KPICard label="Active blueprints" value={kpis.activeBlueprints ?? 0} />
        <KPICard label="Tasks today" value={kpis.tasksCompletedToday ?? 0} />
        <KPICard label="Feedback today" value={kpis.feedbackSubmittedToday ?? 0} />
      </div>

      <div className="flex flex-wrap gap-3">
        <StatusBadge ok={h.database === "connected"} label="Database" />
        <StatusBadge ok={Number(h.stuckEvents ?? 0) === 0} label="Stuck events" />
        <StatusBadge ok={Number(h.deadLetterCount ?? 0) === 0} label="DLQ" />
        <StatusBadge
          ok={Number(h.workerQueueDepth ?? 0) < 50}
          label={`Queue: ${String(h.workerQueueDepth ?? 0)}`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Condition distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.conditions} dataKey="count" nameKey="condition" cx="50%" cy="50%" outerRadius={80}>
                  {data.conditions.map((_, i) => (
                    <Cell key={i} fill={CONDITION_COLORS[i % CONDITION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Signups (7 days)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.signups}>
                <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Live activity</h3>
        <ul className="space-y-2 text-sm text-slate-400 max-h-64 overflow-y-auto">
          {data.activity.events.map((ev) => (
            <li key={String(ev.id)}>
              <span className="text-violet-300">{String(ev.type)}</span> — user{" "}
              {String(ev.userId ?? "—").slice(0, 8)}… at {String(ev.at)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
