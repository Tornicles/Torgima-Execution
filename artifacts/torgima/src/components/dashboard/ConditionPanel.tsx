import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  CONDITION_COLORS,
  getConditionLabel,
  SIGNAL_LABELS,
} from "@/lib/language-map";
import { LANGUAGE } from "@/lib/language";
import type { ConditionPanelData, SignalSummaryStrip } from "@/types/dashboard";

function conditionToneClass(colorKey: string): string {
  const key = colorKey.toLowerCase();
  if (key === "red" || key === "danger") return "bg-amber-50 text-amber-900 border-amber-200";
  if (key === "amber" || key === "urgency") return "bg-orange-50 text-orange-900 border-orange-200";
  if (key === "blue" || key === "stability") return "bg-sky-50 text-sky-900 border-sky-200";
  if (key === "green" || key === "power" || key === "gold" || key === "affluence") {
    return "bg-emerald-50 text-emerald-900 border-emerald-200";
  }
  return "bg-slate-50 text-slate-800 border-slate-200";
}

function momentumTrend(signals: SignalSummaryStrip): {
  label: string;
  Icon: typeof TrendingUp;
  aria: string;
} {
  const t = (signals.trend ?? "").toLowerCase();
  if (t.includes("up") || t.includes("improv") || (signals.momentum != null && signals.momentum > 0.05)) {
    return {
      label: LANGUAGE.progress.direction_values.improving,
      Icon: TrendingUp,
      aria: "Trend rising",
    };
  }
  if (t.includes("down") || t.includes("declin") || (signals.momentum != null && signals.momentum < -0.05)) {
    return {
      label: LANGUAGE.progress.direction_values.declining,
      Icon: TrendingDown,
      aria: "Trend falling",
    };
  }
  return {
    label: LANGUAGE.progress.direction_values.stable,
    Icon: Minus,
    aria: "Trend stable",
  };
}

/** DOC 33 — project status + signal summary from DashboardProjection only. */
export function ConditionPanel({
  condition,
  signals,
}: {
  condition: ConditionPanelData;
  signals: SignalSummaryStrip;
}) {
  const colorKey = CONDITION_COLORS[condition.conditionKey] ?? "grey";
  const trend = momentumTrend(signals);
  const rate =
    signals.completionRate != null
      ? Math.round(signals.completionRate * (signals.completionRate <= 1 ? 100 : 1))
      : null;
  const quality =
    signals.weightedScore != null ? Number(signals.weightedScore).toFixed(1) : null;

  return (
    <section
      className={`rounded-2xl border p-5 ${conditionToneClass(colorKey)}`}
      aria-label="Project status"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Project status</p>
      <p className="mt-1 text-xl font-bold">{condition.label || getConditionLabel(condition.conditionKey)}</p>
      {condition.explanation ? (
        <p className="mt-2 text-sm leading-relaxed opacity-90">{condition.explanation}</p>
      ) : null}

      <div className="mt-4 grid gap-2 text-sm">
        {rate != null ? (
          <p>
            <span className="font-semibold">{SIGNAL_LABELS.completion_rate}:</span> {rate}%
          </p>
        ) : null}
        {quality != null ? (
          <p>
            <span className="font-semibold">{SIGNAL_LABELS.weighted_score}:</span> {quality}/10
          </p>
        ) : null}
        <p className="inline-flex items-center gap-1.5">
          <span className="font-semibold">{SIGNAL_LABELS.momentum}:</span>
          <trend.Icon className="h-4 w-4" aria-hidden />
          <span>{trend.label}</span>
          <span className="sr-only">{trend.aria}</span>
        </p>
      </div>

      {condition.restrictions.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs opacity-75 list-disc pl-4">
          {condition.restrictions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
