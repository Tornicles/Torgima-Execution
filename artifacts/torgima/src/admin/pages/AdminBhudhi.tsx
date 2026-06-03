import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAdminBhudhi } from "@/admin/api/adminClient";
import { KPICard } from "@/admin/components/KPICard";

export default function AdminBhudhiPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void fetchAdminBhudhi().then(setData);
  }, []);

  if (!data) return <p className="text-slate-400">Loading Bhudhi usage…</p>;

  const today = data.today as Record<string, number>;
  const trend = (data.dailyTrend as Array<{ day: string; calls: number }>) ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Bhudhi usage</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Calls today" value={today.calls ?? 0} />
        <KPICard label="Tokens today" value={today.tokens ?? 0} />
        <KPICard label="Est. cost" value={`$${(today.estimatedCostUsd ?? 0).toFixed(2)}`} />
        <KPICard label="Success rate" value={`${Math.round((today.successRate ?? 1) * 100)}%`} />
      </div>
      <div className="h-64 rounded-xl border border-slate-800 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="calls" stroke="#a78bfa" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
