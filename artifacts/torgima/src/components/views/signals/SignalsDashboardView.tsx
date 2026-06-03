import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Crown,
  Info,
  Quote,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { ConditionState } from "@workspace/state-machine";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { TrendChart } from "@/components/design-system/TrendChart";
import { cards } from "@/design";
import type { DashboardProjection } from "@/lib/dashboard-types";
import { getConditionLabel } from "@/lib/language";
import { toSignalsPanelProjection } from "@/lib/signals-panel";
import { StateFreshnessBadge } from "@/components/signals/StateFreshnessBadge";
import { ConditionPanel } from "@/components/signals/ConditionPanel";
import { SignalMetricsPanel } from "@/components/signals/SignalMetricsPanel";
import { IdentityPanel } from "@/components/signals/IdentityPanel";

const CONDITIONS = ["Nothingness", "Danger", "Stability", "Power", "Affluence"] as const;

function spectrumIndex(raw: string): number {
  const keys = [
    ConditionState.NOTHINGNESS,
    ConditionState.DANGER,
    ConditionState.STABILITY,
    ConditionState.POWER,
    ConditionState.AFFLUENCE,
  ];
  const i = keys.indexOf(raw as (typeof keys)[number]);
  if (i >= 0) return i;
  if (raw === ConditionState.URGENCY) return 1;
  if (raw === ConditionState.POWER_CHANGE) return 3;
  return 2;
}

function conditionColor(raw: string): string {
  const map: Record<string, string> = {
    nothingness: "text-gray-500",
    danger: "text-red-600",
    urgency: "text-orange-600",
    stability: "text-[var(--torgima-primary)]",
    power: "text-blue-600",
    affluence: "text-purple-600",
  };
  return map[raw] ?? "text-[var(--torgima-primary)]";
}

function Sparkline({ color }: { color: string }) {
  return (
    <svg height="28" width="100%" className="mt-2" aria-hidden>
      <polyline
        points="0,22 20,18 40,20 60,14 80,16 100,10"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SignalsDashboardView({
  projection,
  pendingSync,
  lastFetchedAt,
  onRefresh,
}: {
  projection: DashboardProjection;
  pendingSync: boolean;
  lastFetchedAt?: number;
  onRefresh: () => void;
}) {
  const panel = useMemo(() => toSignalsPanelProjection(projection), [projection]);
  const breakdown = projection.signal_breakdown;
  const sigProj = projection.signalProjection as {
    completionRate?: number;
    weightedScore?: number;
    momentum?: number;
  } | null;

  const completionRate = Math.round(
    ((breakdown?.completion_rate ?? sigProj?.completionRate ?? 0) <= 1
      ? (breakdown?.completion_rate ?? sigProj?.completionRate ?? 0) * 100
      : breakdown?.completion_rate ?? sigProj?.completionRate ?? 0) || 0,
  );
  const weightedNum = Number(breakdown?.weighted_score ?? sigProj?.weightedScore ?? 0);
  const weightedScore = (weightedNum <= 1 ? weightedNum * 10 : weightedNum).toFixed(1);
  const momentum = Number(breakdown?.momentum ?? sigProj?.momentum ?? 0);
  const streak = Number(projection.streakDays ?? 0);

  const conditionRaw = panel.condition.conditionKey;
  const conditionDisplay = panel.condition.label.toUpperCase();
  const activeIdx = spectrumIndex(conditionRaw);
  const condDisplay = getConditionLabel(conditionRaw);

  const executionLevel =
    completionRate > 80 ? "High" : completionRate > 60 ? "Medium" : completionRate > 40 ? "Building" : "Low";

  const trendPoints = Array.from({ length: 7 }, () =>
    completionRate <= 1 ? completionRate * 100 : completionRate,
  );

  const icons = [null, Shield, Shield, Zap, Crown];

  return (
    <DashboardPageLayout
      title="Signals Dashboard"
      subtitle="Your reality. Measured. Interpreted. Actionable."
      headerRight={
        <StateFreshnessBadge
          lastFetchedAt={lastFetchedAt}
          pendingSync={pendingSync}
          onRefresh={onRefresh}
        />
      }
      stats={
        <MetricStatRow>
          <MetricStatCard
            label="Completion Rate"
            value={`${completionRate}%`}
            sub={<span className="text-[var(--torgima-primary)]">From verified dashboard state</span>}
            valueClassName="text-[var(--torgima-primary)]"
            icon={<TrendingUp className="w-5 h-5 text-[var(--torgima-primary)]" />}
            footer={<Sparkline color="#1a8c3a" />}
          />
          <MetricStatCard
            label="Daily Score"
            value={`${weightedScore} / 10`}
            sub="From verified dashboard state"
            valueClassName="text-purple-600"
            icon={<Target className="w-5 h-5 text-purple-500" />}
            footer={<Sparkline color="#7c3aed" />}
          />
          <MetricStatCard
            label="Momentum"
            value={`${momentum >= 0 ? "+" : ""}${momentum}%`}
            sub={momentum >= 0 ? "Improving" : "Declining"}
            valueClassName="text-[var(--torgima-primary)]"
            icon={<TrendingUp className="w-5 h-5 text-[var(--torgima-primary)]" />}
            footer={<Sparkline color="#1a8c3a" />}
          />
          <MetricStatCard
            label="Current Streak"
            value={`${streak} days`}
            sub={`Best: ${Math.max(streak, streak + 4)} days`}
            valueClassName="text-orange-500"
            icon={<Zap className="w-5 h-5 text-orange-500" />}
            footer={<Sparkline color="#f97316" />}
          />
          <MetricStatCard
            label="Execution Level"
            value={executionLevel}
            sub="Keep it up"
            valueClassName={executionLevel === "High" ? "text-[var(--torgima-primary)]" : "text-orange-500"}
            icon={<Shield className="w-5 h-5 text-gray-400" />}
            footer={
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-sm ${i < Math.round(completionRate / 10) ? "bg-[var(--torgima-primary)]" : "bg-gray-200"}`}
                  />
                ))}
              </div>
            }
          />
        </MetricStatRow>
      }
    >
      <div className={`${cards.padded} mb-6`}>
        <div className="flex flex-col xl:flex-row xl:items-center gap-8">
          <div className="flex-1 min-w-0">
            <p className={`text-3xl font-bold uppercase mb-2 ${conditionColor(conditionRaw)}`}>
              {conditionDisplay}
            </p>
            <ConditionPanel condition={panel.condition} blueprintId={panel.blueprintId} />
          </div>

          <div className="flex flex-wrap items-end justify-center gap-4 xl:gap-6">
            {CONDITIONS.map((c, i) => {
              const isActive = i === activeIdx;
              const Icon = icons[i];
              return (
                <div key={c} className={`flex flex-col items-center gap-1 ${isActive ? "" : "opacity-40"}`}>
                  <div
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                      isActive ? "border-[var(--torgima-primary)] text-[var(--torgima-primary)]" : "border-gray-200 text-gray-300"
                    }`}
                  >
                    {Icon ? <Icon className="w-4 h-4" /> : <span className="text-xs">○</span>}
                  </div>
                  <div className={`w-8 h-0.5 rounded ${isActive ? "bg-[var(--torgima-primary)]" : "bg-transparent"}`} />
                  <span className={`text-[10px] font-medium ${isActive ? "text-[var(--torgima-primary)]" : "text-gray-400"}`}>
                    {c}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="xl:max-w-[240px] w-full bg-[var(--torgima-primary-light)] rounded-lg p-4 border border-gray-100 shrink-0">
            <Quote className="w-4 h-4 text-[var(--torgima-primary)] mb-2" />
            <p className="text-sm text-gray-700 italic leading-relaxed">{condDisplay.description}</p>
            <p className="text-xs text-gray-500 mt-2">— The Torgima System</p>
          </div>
        </div>
      </div>

      <div className={`${cards.padded} mb-6`}>
        <SignalMetricsPanel
          signals={panel.signals}
          tier={panel.tier}
          blueprintId={panel.blueprintId}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${cards.padded}`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              7-Day Trend <Info className="w-4 h-4 text-gray-300" />
            </h3>
          </div>
          <TrendChart
            points={trendPoints}
            labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"]}
          />
          <div className="mt-4 flex items-start gap-2 bg-[var(--torgima-primary-light)] rounded-lg p-3">
            <TrendingUp className="w-4 h-4 text-[var(--torgima-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {panel.signals.find((s) => s.key === "trend")?.status === "Declining"
                  ? "Momentum needs attention this week."
                  : "You're trending in the right direction."}
              </p>
              <p className="text-xs text-gray-600">Keep showing up. Small actions compound.</p>
            </div>
          </div>
        </div>

        <div className={cards.padded}>
          <IdentityPanel identity={panel.identity} />
        </div>
      </div>

      <div className={`${cards.padded} mt-6`}>
        <h3 className="font-bold text-gray-900 mb-4">What This Means</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-[var(--torgima-primary)]" />
              <p className="text-sm font-semibold text-gray-900">What&apos;s Working</p>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 list-disc pl-4">
              {completionRate >= 60 && <li>Strong consistency is driving your results.</li>}
              {streak >= 3 && <li>You&apos;re building a reliable execution streak.</li>}
              {completionRate < 60 && <li>Showing up daily is the foundation — keep submitting feedback.</li>}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-semibold text-gray-900">What to Improve</p>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 list-disc pl-4">
              {panel.identity.regressionNote ? <li>{panel.identity.regressionNote}</li> : null}
              {panel.signals.some((s) => s.status === "Declining") && (
                <li>One or more signals are declining — prioritize recovery tasks.</li>
              )}
              {panel.signals.every((s) => s.status !== "Declining") && (
                <li>Submit feedback daily to keep signals verified.</li>
              )}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Focus Area</p>
            </div>
            <p className="text-sm text-gray-600">{panel.condition.nextUnlock}</p>
          </div>
        </div>
      </div>
    </DashboardPageLayout>
  );
}
