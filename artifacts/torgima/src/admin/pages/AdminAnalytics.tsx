import { useEffect, useState } from "react";
import { fetchAdminAnalytics } from "@/admin/api/adminClient";
import { KPICard } from "@/admin/components/KPICard";

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void fetchAdminAnalytics(days).then(setData);
  }, [days]);

  if (!data) return <p className="text-slate-400">Loading analytics…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-slate-700 bg-slate-950 text-sm text-white px-3 py-1"
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Signups" value={Number(data.signups ?? 0)} />
        <KPICard label="Activations" value={Number(data.blueprintActivations ?? 0)} />
        <KPICard label="Task completion rate" value={`${Math.round(Number(data.taskCompletionRate ?? 0) * 100)}%`} />
        <KPICard label="Users in danger" value={Number(data.usersInDanger ?? 0)} />
      </div>
    </div>
  );
}
