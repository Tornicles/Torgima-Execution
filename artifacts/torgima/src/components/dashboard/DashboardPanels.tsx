import { Link } from "wouter";
import { ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { DashboardAlert, DashboardProjection } from "@/lib/dashboard-types";

const CONDITION_UI: Record<string, { icon: string; message: string; bg: string; color: string }> = {
  stability: { icon: "🛡️", message: "Execution chain stable — maintain continuity.", bg: "bg-green-50", color: "text-green-700" },
  power: { icon: "⚡", message: "Elevated execution — scale disciplined output.", bg: "bg-blue-50", color: "text-blue-700" },
  affluence: { icon: "👑", message: "Maximum capacity window — prioritize leverage.", bg: "bg-purple-50", color: "text-purple-700" },
  urgency: { icon: "🔥", message: "Continuity needs reinforcement.", bg: "bg-orange-50", color: "text-orange-700" },
  danger: { icon: "⚠️", message: "Recovery stance — protect signal quality.", bg: "bg-red-50", color: "text-red-700" },
  nothingness: { icon: "○", message: "Baseline initializing — complete your first order.", bg: "bg-gray-50", color: "text-gray-700" },
  power_change: { icon: "↗️", message: "Condition transition — adaptation active.", bg: "bg-amber-50", color: "text-amber-700" },
};

export function ConditionPanel({ state }: { state: DashboardProjection }) {
  const detail = state.conditionDetail as { condition?: string } | undefined;
  const key = (detail?.condition ?? (state.signals as { condition?: string })?.condition ?? "nothingness").toLowerCase();
  const cfg = CONDITION_UI[key] ?? CONDITION_UI.nothingness;
  const enforcement = state.enforcement as { allowedActions?: string[]; blockedActions?: string[] } | null;

  return (
    <section className={`rounded-2xl border border-gray-200 p-5 ${cfg.bg}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current condition</p>
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>{cfg.icon}</span>
        <span className={`text-lg font-bold uppercase ${cfg.color}`}>{key.replace("_", " ")}</span>
      </div>
      <p className="text-xs text-gray-600 mt-2">{cfg.message}</p>
      {enforcement && (
        <div className="mt-3 pt-3 border-t border-gray-200/60 space-y-1 text-xs text-gray-600">
          {enforcement.allowedActions && enforcement.allowedActions.length > 0 && (
            <p>
              <span className="font-semibold">Allowed:</span> {enforcement.allowedActions.slice(0, 4).join(", ")}
            </p>
          )}
          {enforcement.blockedActions && enforcement.blockedActions.length > 0 && (
            <p>
              <span className="font-semibold">Blocked:</span> {enforcement.blockedActions.slice(0, 4).join(", ")}
            </p>
          )}
        </div>
      )}
      <Link href="/signals">
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-700 cursor-pointer hover:underline">
          Signal & identity panel <ChevronRight className="w-4 h-4" />
        </span>
      </Link>
    </section>
  );
}

export function SignalSummaryPanel({ state }: { state: DashboardProjection }) {
  const sp = state.signalProjection as {
    completionRate?: number;
    weightedScore?: number;
    momentum?: number;
    trend?: string | null;
  } | null;
  const completion = sp ? Math.round((sp.completionRate ?? 0) * 100) : Math.round((state.signals as { consistency?: number })?.consistency ?? 0);
  const score = sp?.weightedScore ?? (state.signals as { velocity?: number })?.velocity ?? 0;
  const momentum = sp?.momentum ?? (state.signals as { streak?: number })?.streak ?? 0;
  const trend = sp?.trend ?? "stable";

  const TrendIcon = trend === "improving" ? TrendingUp : trend === "declining" ? TrendingDown : Minus;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signal summary</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{completion}%</p>
          <p className="text-[10px] text-gray-500 uppercase">Completion</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{Number(score).toFixed(1)}</p>
          <p className="text-[10px] text-gray-500 uppercase">Score</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-1">
            {momentum}
            <TrendIcon className="w-4 h-4 text-gray-400" />
          </p>
          <p className="text-[10px] text-gray-500 uppercase">Momentum</p>
        </div>
      </div>
    </section>
  );
}

export function AlertsPanel({ alerts }: { alerts?: DashboardAlert[] }) {
  if (!alerts?.length) return null;
  const severityClass = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    critical: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alerts</p>
      {alerts.map((a) => (
        <div key={a.code} className={`rounded-xl border px-4 py-3 text-sm ${severityClass[a.severity]}`}>
          <p>{a.message}</p>
          {a.actionHref && a.actionLabel && (
            <Link href={a.actionHref}>
              <span className="mt-2 inline-block text-xs font-semibold underline cursor-pointer">{a.actionLabel}</span>
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}

export function ProgressOverviewPanel({ state }: { state: DashboardProjection }) {
  const bp = state.activeBlueprint as {
    title?: string;
    rawGoal?: string;
    phase?: number;
    totalPhases?: number;
  } | null;
  if (!bp) return null;
  const total = bp.totalPhases ?? 4;
  const phase = bp.phase ?? 1;
  const pct = Math.min(100, Math.round((phase / Math.max(total, 1)) * 100));

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</p>
        <Link href={`/blueprint/${(bp as { id?: string }).id ?? ""}`}>
          <span className="text-xs text-green-600 font-medium cursor-pointer hover:underline">Blueprint map</span>
        </Link>
      </div>
      <p className="font-semibold text-gray-900 truncate">{bp.title ?? bp.rawGoal}</p>
      <p className="text-xs text-gray-500">Phase {phase} of {total}</p>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

export function IdentityRewardStrip({ state }: { state: DashboardProjection }) {
  const lines = state.executionIdentityLines as string[] | undefined;
  const streak = Number(state.streakDays ?? 0);
  const week = Number(state.tasksCompletedThisWeek ?? 0);

  return (
    <section className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Identity (Growth+)</p>
        {lines && lines.length > 0 ?
          <ul className="text-sm text-gray-700 space-y-1">
            {lines.slice(0, 3).map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        : <p className="text-sm text-gray-500">Complete more execution cycles to establish identity evidence.</p>}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Rewards & streaks</p>
        <p className="text-sm text-gray-700">
          <span className="font-bold text-orange-600">{streak}</span> day momentum streak ·{" "}
          <span className="font-bold text-green-600">{week}</span> reports this week
        </p>
      </div>
    </section>
  );
}
