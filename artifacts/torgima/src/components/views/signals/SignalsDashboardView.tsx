import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
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
import { cards, PageLoading } from "@/design";
import { apiGet, getCurrentSignals, getSignalHistory, getCurrentCondition } from "@/lib/torgima-api";

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

export function SignalsDashboardView() {
  const [signals, setSignals] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [conditionRow, setConditionRow] = useState<{
    condition?: string;
    transitionReason?: string | null;
  } | null>(null);
  const [character, setCharacter] = useState<Record<string, number> | null>(null);
  const [metric, setMetric] = useState<"completion" | "score" | "momentum">("completion");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCurrentSignals(),
      getSignalHistory(),
      getCurrentCondition(),
      apiGet<{ character?: Record<string, number> }>("/api/character/current").catch(() => null),
    ])
      .then(([cur, hist, cond, charRes]) => {
        setSignals(cur as Record<string, unknown>);
        const snaps =
          (hist as { snapshots?: Array<Record<string, unknown>> })?.snapshots ??
          (Array.isArray(hist) ? (hist as Array<Record<string, unknown>>) : []);
        setHistory(snaps.slice(-14));
        const payload = cond as { condition?: { condition?: string; transitionReason?: string | null } };
        setConditionRow(payload.condition ?? null);
        if (charRes?.character) setCharacter(charRes.character);
      })
      .finally(() => setLoading(false));
  }, []);

  const sig = signals?.signal as Record<string, unknown> | undefined;
  const conditionRaw = (
    conditionRow?.condition ??
    (sig?.assignedCondition as string) ??
    (sig?.condition as string) ??
    ConditionState.STABILITY
  )
    .toString()
    .toLowerCase();
  const conditionDisplay = conditionRaw.replace(/_/g, " ").toUpperCase();
  const activeIdx = spectrumIndex(conditionRaw);

  const completionRate = Math.round(((sig?.completionRate as number) ?? 0) * 100);
  const weightedNum = Number((sig?.weightedScore as number) ?? 0);
  const weightedScore = weightedNum.toFixed(1);
  const momentum = Number((sig?.momentum as number) ?? 0);
  const streak = Number((sig?.streakDays as number) ?? 0);
  const prevCompletion = history.length >= 2
    ? Math.round(((history[history.length - 2]?.completionRate as number) ?? 0) * 100)
    : completionRate;
  const completionDelta = completionRate - prevCompletion;

  const trendPoints = useMemo(() => {
    return history.slice(-7).map((s) => {
      if (metric === "score") {
        const w = (s.weightedScore as number) ?? 0;
        return w <= 1 ? w * 10 : w;
      }
      if (metric === "momentum") return Number(s.momentum ?? 0);
      const cr = (s.completionRate as number) ?? 0;
      return cr <= 1 ? cr * 100 : cr;
    });
  }, [history, metric]);

  const clamp10 = (n: number) => Math.min(10, Math.max(0, Number(n.toFixed(1))));
  const traitScore = (v: number) => clamp10(v <= 1 ? v * 10 : v);

  const traits = character
    ? [
        { label: "Consistency", score: traitScore(character.consistency ?? 0) },
        { label: "Discipline", score: traitScore(character.discipline ?? 0) },
        { label: "Grit", score: traitScore(character.grit ?? 0) },
        { label: "Execution Intelligence", score: traitScore(character.executionIntelligence ?? 0) },
        { label: "Adaptability", score: traitScore(character.adaptability ?? 0) },
      ]
    : [];

  const executionLevel =
    completionRate > 80 ? "High" : completionRate > 60 ? "Medium" : completionRate > 40 ? "Building" : "Low";

  if (loading) return <PageLoading />;

  const conditionDesc =
    conditionRaw === "stability"
      ? "You're in a productive state. Keep building consistency to reach Power."
      : conditionRaw === "danger" || conditionRaw === "urgency"
        ? "Recovery-oriented enforcement — complete proof-backed feedback to restore capacity."
        : "Condition reflects your latest signal telemetry from execution feedback.";

  const icons = [null, Shield, Shield, Zap, Crown];

  return (
    <DashboardPageLayout
      title="Signals Dashboard"
      subtitle="Your reality. Measured. Interpreted. Actionable."
      headerRight={
        <span className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-600">
          Last 7 days
        </span>
      }
      stats={
        <MetricStatRow>
          <MetricStatCard
            label="Completion Rate"
            value={`${completionRate}%`}
            sub={
              <span className={completionDelta >= 0 ? "text-[var(--torgima-primary)]" : "text-red-600"}>
                {completionDelta >= 0 ? "+" : ""}
                {completionDelta}% vs last 7 days
              </span>
            }
            valueClassName="text-[var(--torgima-primary)]"
            icon={<TrendingUp className="w-5 h-5 text-[var(--torgima-primary)]" />}
            footer={<Sparkline color="#1a8c3a" />}
          />
          <MetricStatCard
            label="Daily Score"
            value={`${weightedScore} / 10`}
            sub="vs last 7 days"
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Condition</p>
            <p className={`text-3xl font-bold uppercase ${conditionColor(conditionRaw)}`}>{conditionDisplay}</p>
            <p className="text-sm text-gray-600 mt-2">{conditionDesc}</p>
            {conditionRow?.transitionReason && (
              <p className="text-xs text-gray-500 mt-2">Transition: {conditionRow.transitionReason}</p>
            )}
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
            <p className="text-sm text-gray-700 italic leading-relaxed">
              Your actions today shape your tomorrow. Consistency is your leverage.
            </p>
            <p className="text-xs text-gray-500 mt-2">— The Torgima System</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${cards.padded}`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              7-Day Trend <Info className="w-4 h-4 text-gray-300" />
            </h3>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white"
              value={metric}
              onChange={(e) => setMetric(e.target.value as typeof metric)}
              aria-label="Metric"
            >
              <option value="completion">Completion Rate</option>
              <option value="score">Daily Score</option>
              <option value="momentum">Momentum</option>
            </select>
          </div>
          <TrendChart
            points={trendPoints.length ? trendPoints : [completionRate]}
            labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].slice(-(trendPoints.length || 7))}
          />
          <div className="mt-4 flex items-start gap-2 bg-[var(--torgima-primary-light)] rounded-lg p-3">
            <TrendingUp className="w-4 h-4 text-[var(--torgima-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {completionDelta >= 0
                  ? "You're trending in the right direction."
                  : "Momentum needs attention this week."}
              </p>
              <p className="text-xs text-gray-600">Keep showing up. Small actions compound.</p>
            </div>
          </div>
        </div>

        <div className={cards.padded}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Character Traits</h3>
            <Link href="/character" className="text-xs text-[var(--torgima-primary)] font-medium hover:underline">
              View All Traits →
            </Link>
          </div>
          {traits.length === 0 ? (
            <p className="text-sm text-gray-500">Complete orders to build your character profile.</p>
          ) : (
            <div className="space-y-4">
              {traits.map((trait) => {
                const pct = (trait.score / 10) * 100;
                const barColor =
                  trait.score >= 8 ? "bg-[var(--torgima-primary)]" : trait.score >= 6 ? "bg-amber-400" : "bg-orange-500";
                return (
                  <div key={trait.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{trait.label}</span>
                      <span
                        className={`font-bold ${trait.score >= 6 ? "text-[var(--torgima-primary)]" : "text-orange-500"}`}
                      >
                        {trait.score} / 10
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              {traits.find((t) => t.label === "Grit" && t.score < 7) && (
                <li>Build more grit to handle tougher phases.</li>
              )}
              {traits.find((t) => t.label === "Adaptability" && t.score < 7) && (
                <li>Adaptability can help you pivot faster.</li>
              )}
              {!traits.length && <li>Submit feedback daily to unlock personalized insights.</li>}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Focus Area</p>
            </div>
            <p className="text-sm text-gray-600">
              {conditionRaw === "stability"
                ? "Maintain consistency and push execution quality. This is the bridge to Power."
                : "Stabilize daily completion before expanding scope."}
            </p>
          </div>
        </div>
      </div>
    </DashboardPageLayout>
  );
}
