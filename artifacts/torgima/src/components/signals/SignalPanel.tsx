import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import type { SignalSummaryModel } from "@/types/signals-panel";

function DirectionArrow({ direction }: { direction: SignalSummaryModel["direction"] }) {
  if (direction === "up") return <ArrowUp className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (direction === "down") return <ArrowDown className="h-4 w-4 text-orange-600" aria-hidden />;
  return <ArrowRight className="h-4 w-4 text-gray-500" aria-hidden />;
}

function freshnessClass(freshness: SignalSummaryModel["freshness"]): string {
  if (freshness === "stale") return "bg-amber-50 text-amber-900 border-amber-200";
  if (freshness === "outdated") return "bg-amber-50 text-amber-900 border-amber-200";
  if (freshness === "updating") return "bg-violet-50 text-violet-800 border-violet-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function Sparkline({ points }: { points: number[] }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const coords = points
    .map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * 100;
      const y = 24 - (v / max) * 20;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className="mt-3 h-7 w-full" aria-hidden>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--torgima-primary)]" />
    </svg>
  );
}

/** DOC 35 — read-only health score + four breakdown metrics from projection. */
export function SignalPanel({
  summary,
  tier,
  onRetry,
}: {
  summary: SignalSummaryModel;
  tier: string;
  onRetry?: () => void;
}) {
  if (!summary.hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">{LANGUAGE.signalsPanel.noDataYet}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 text-sm font-semibold text-[var(--torgima-primary)] underline"
          >
            {LANGUAGE.signalsPanel.retry}
          </button>
        ) : null}
      </div>
    );
  }

  const pct = summary.healthScore;
  const ringStyle = {
    background: `conic-gradient(var(--torgima-primary) ${pct * 3.6}deg, #e5e7eb 0deg)`,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
            style={ringStyle}
            role="img"
            aria-label={`${LANGUAGE.signalsPanel.healthScore} ${pct} out of 100`}
          >
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white text-center">
              <span className="text-lg font-bold text-gray-900">{pct}</span>
              <span className="text-[10px] text-gray-500">/100</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {LANGUAGE.signalsPanel.healthScore}
            </p>
            <p className="text-xl font-bold text-gray-900">{summary.healthLabel}</p>
            <span
              className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${freshnessClass(summary.freshness)}`}
            >
              {summary.freshnessLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric
          label={LANGUAGE.signalsPanel.signalLabels.completion_rate}
          value={`${summary.completionRatePct}%`}
          direction={summary.direction}
        />
        <Metric
          label={LANGUAGE.signalsPanel.workQuality}
          value={`${summary.workQuality} / 10`}
          direction={summary.direction}
        />
        <Metric
          label={LANGUAGE.signalsPanel.momentumDays}
          value={LANGUAGE.signalsPanel.streakDays(summary.momentumDays)}
          direction={summary.momentumDays > 0 ? "up" : "flat"}
        />
        <Metric
          label={LANGUAGE.signalsPanel.direction}
          value={summary.directionLabel}
          direction={summary.direction}
        />
      </div>

      {tier !== "starter" ? (
        <div>
          <p className="text-xs font-semibold text-gray-500">
            {summary.historyDays}-day trend
          </p>
          <Sparkline points={summary.historyPoints} />
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  direction,
}: {
  label: string;
  value: string;
  direction: SignalSummaryModel["direction"];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <DirectionArrow direction={direction} />
        <span>{value}</span>
      </p>
    </div>
  );
}
