import { Link, useLocation } from "wouter";
import { AlertTriangle, CheckCircle2, Clock, Shield, Target, TrendingDown } from "lucide-react";
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

function isDone(status: string) {
  return ["completed", "done", "finished"].includes(status.toLowerCase());
}

export function RecoveryDashboardView() {
  const [, setLocation] = useLocation();
  const { orders, completionRate, dailyScore, streak, momentum, conditionLabel, conditionRaw, isLoading } =
    useDashboardMetrics();

  const needsRecovery = ["danger", "urgency"].includes(conditionRaw.toLowerCase());

  if (isLoading) return <PageLoading />;

  if (!needsRecovery) {
    return (
      <DashboardPageLayout title="Recovery" subtitle="Reset, realign, and rebuild momentum. The system adapts with you.">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="w-14 h-14 text-[var(--torgima-primary)] mb-4" />
          <h2 className="text-xl font-bold text-gray-900">No recovery needed. Keep executing.</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            You are currently in <span className="font-semibold text-gray-800">{conditionLabel}</span> state.
          </p>
          <Link href="/signals" className={`mt-6 ${buttons.primary} inline-flex items-center gap-2`}>
            View Signals →
          </Link>
        </div>
      </DashboardPageLayout>
    );
  }

  const recoveryOrders = orders.slice(0, 5);
  const completed = recoveryOrders.filter((o) => isDone(o.status)).length;
  const pct = recoveryOrders.length ? Math.round((completed / recoveryOrders.length) * 100) : 0;

  return (
    <DashboardPageLayout
      title="Recovery"
      subtitle="Reset, realign, and rebuild momentum. The system adapts with you."
      stats={
        <MetricStatRow>
          <MetricStatCard label="Current Condition" value="DANGER" sub="Needs Immediate Attention" valueClassName="text-orange-600" icon={<Shield className="w-5 h-5 text-orange-500" />} />
          <MetricStatCard label="Impact Level" value="High" sub="Significant impact detected" valueClassName="text-red-600" icon={<AlertTriangle className="w-5 h-5 text-red-500" />} />
          <MetricStatCard label="Momentum Drop" value={`${momentum < 0 ? "" : "-"}${Math.abs(momentum)}%`} sub="vs last week" valueClassName="text-red-600" icon={<TrendingDown className="w-5 h-5 text-red-500" />} />
          <MetricStatCard label="Recovery Priority" value="High" sub="Focus and execute" valueClassName="text-red-600" icon={<Target className="w-5 h-5 text-red-500" />} />
          <MetricStatCard label="Est. Recovery" value="5–7 days" sub="With consistent actions" valueClassName="text-[var(--torgima-primary)]" icon={<Clock className="w-5 h-5 text-[var(--torgima-primary)]" />} />
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
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">What you should avoid</p>
            <ul className="text-sm text-red-700 space-y-2">
              <li>✕ Adding new projects or tasks</li>
              <li>✕ Skipping daily feedback</li>
              <li>✕ Overcommitting on scope</li>
            </ul>
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
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">1. Current Situation</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">What Happened?</p>
            <p className="text-sm text-gray-600">
              Your completion rate dropped to {completionRate}%. Daily score is {dailyScore}/10. The system detected
              inconsistent execution and adjusted your condition to {conditionLabel}.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Completion</p>
                <p className="font-bold text-red-600">{completionRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Daily Score</p>
                <p className="font-bold text-red-600">{dailyScore}/10</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Streak</p>
                <p className="font-bold text-orange-500">{streak} days</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Trend</p>
                <p className="font-bold text-red-600">Declining</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Impact on Your Journey</p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
              <li>Slower blueprint progress</li>
              <li>Increased execution risk</li>
              <li>Lower momentum until recovery completes</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">2. Recovery Plan</p>
        <div className="flex flex-wrap gap-4 justify-between">
          {STEPS.map((step) => (
            <div key={step.label} className="flex flex-col items-center text-center min-w-[100px] flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  step.status === "done"
                    ? "bg-[var(--torgima-primary)] text-white"
                    : step.status === "active"
                      ? "border-2 border-blue-500 text-blue-600"
                      : "border border-gray-200 text-gray-400"
                }`}
              >
                {step.status === "done" ? "✓" : "○"}
              </div>
              <p className="text-xs font-medium text-gray-700 mt-2">{step.label}</p>
              <p className="text-[10px] text-gray-400 capitalize">{step.status}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={cards.padded}>
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs font-bold uppercase text-gray-500">3. Recovery Orders (Today)</p>
          <Link href="/orders" className="text-sm text-[var(--torgima-primary)] font-medium">
            View All Orders →
          </Link>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          {completed} / {recoveryOrders.length} completed
        </p>
        <ProgressBar value={pct} className="mb-4" />
        {recoveryOrders.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No recovery orders for today.</p>
        ) : (
          <ol className="space-y-2">
            {recoveryOrders.map((order) => (
              <li key={order.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${isDone(order.status) ? "bg-[var(--torgima-primary)] text-white border-[var(--torgima-primary)]" : "border-gray-300"}`}>
                  {isDone(order.status) ? "✓" : ""}
                </span>
                <span className={`text-sm flex-1 ${isDone(order.status) ? "line-through text-gray-400" : "text-gray-900"}`}>
                  {order.title}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{order.type}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </DashboardPageLayout>
  );
}
