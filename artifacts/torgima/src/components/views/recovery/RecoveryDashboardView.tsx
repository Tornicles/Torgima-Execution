import { useLocation } from "wouter";
import { AlertTriangle, Clock, Shield, Target, TrendingDown } from "lucide-react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { StickyFooter } from "@/components/design-system/StickyFooter";
import { cards, buttons, PageLoading } from "@/design";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

const STEPS = [
  { label: "Identify Cause", status: "done" },
  { label: "Reset Focus", status: "active" },
  { label: "Stabilize Execution", status: "pending" },
  { label: "Rebuild Momentum", status: "pending" },
  { label: "Restore Power", status: "pending" },
];

export function RecoveryDashboardView() {
  const [, setLocation] = useLocation();
  const { orders, completionRate, dailyScore, streak, conditionLabel, conditionRaw, isLoading } =
    useDashboardMetrics();

  const isDanger = ["danger", "urgency"].includes(conditionRaw.toLowerCase());
  const displayCondition = isDanger ? "DANGER" : conditionLabel;

  if (isLoading) return <PageLoading />;

  const recoveryOrders = orders.length
    ? orders.slice(0, 5)
    : [
        { id: "r1", title: "Review what went wrong this week", type: "Reflection" },
        { id: "r2", title: "Complete one high-impact order", type: "Execution" },
      ];

  return (
    <DashboardPageLayout
      title="Recovery"
      subtitle="Reset, realign, and rebuild momentum. The system adapts with you."
      stats={
        <MetricStatRow>
          <MetricStatCard label="Current Condition" value={displayCondition} sub="Needs attention" valueClassName="text-red-600" icon={<Shield className="w-5 h-5 text-red-500" />} />
          <MetricStatCard label="Impact Level" value="High" sub="Significant impact" valueClassName="text-purple-600" icon={<AlertTriangle className="w-5 h-5 text-purple-500" />} />
          <MetricStatCard label="Momentum Drop" value="-18%" sub="vs last week" valueClassName="text-orange-500" icon={<TrendingDown className="w-5 h-5 text-orange-500" />} />
          <MetricStatCard label="Recovery Priority" value="High" sub="Focus and execute" valueClassName="text-blue-600" icon={<Target className="w-5 h-5 text-blue-500" />} />
          <MetricStatCard label="Est. Recovery" value="5–7 days" sub="With consistency" valueClassName="text-emerald-600" icon={<Clock className="w-5 h-5 text-emerald-500" />} />
        </MetricStatRow>
      }
      rightRail={
        <>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Recovery insights</p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>Inconsistent execution detected</li>
              <li>Focus on stabilization first</li>
              <li>Reduce scope until momentum returns</li>
            </ul>
          </div>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Condition repair</p>
            {["Focus", "Discipline", "Consistency", "Execution Intelligence", "Adaptability"].map((t, i) => (
              <div key={t} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>{t}</span>
                  <span>{[60, 40, 40, 45, 70][i]}%</span>
                </div>
                <ProgressBar value={[60, 40, 40, 45, 70][i]} />
              </div>
            ))}
          </div>
        </>
      }
      footer={
        <StickyFooter
          message="You can recover stronger. Small consistent actions today create massive results tomorrow."
          action={
            <button type="button" onClick={() => setLocation("/orders")} className={buttons.primary}>
              Start Recovery Mode →
            </button>
          }
        />
      }
    >
      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-3">1. Current situation</p>
        <p className="text-sm text-gray-700">
          Completion rate is {completionRate}% with daily score {dailyScore}/10. Streak: {streak} days. The rule
          engine assigned <strong>{displayCondition}</strong> — recovery orders help rebuild momentum.
        </p>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">2. Recovery plan</p>
        <div className="flex flex-wrap gap-2 justify-between">
          {STEPS.map((s) => (
            <div key={s.label} className="text-center flex-1 min-w-[80px]">
              <div
                className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold ${
                  s.status === "done"
                    ? "bg-emerald-500 text-white"
                    : s.status === "active"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {s.status === "done" ? "✓" : "•"}
              </div>
              <p className="text-[10px] mt-2 text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">3. Recovery orders (today)</p>
        <ul className="space-y-2">
          {recoveryOrders.map((o, i) => (
            <li key={o.id} className="flex items-center gap-2 text-sm py-2 border-b border-gray-50 last:border-0">
              <input type="checkbox" className="rounded" defaultChecked={i < 2} />
              <span className="flex-1">{o.title}</span>
              <span className="text-xs text-gray-400">{o.type}</span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardPageLayout>
  );
}
