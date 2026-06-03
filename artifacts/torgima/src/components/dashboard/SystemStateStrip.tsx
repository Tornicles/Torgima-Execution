import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import type { SignalSummaryStrip } from "@/types/dashboard";

function momentumLabel(trend?: string, momentum?: number): string {
  const t = (trend ?? "").toLowerCase();
  if (t.includes("up") || t.includes("improv") || (momentum != null && momentum > 0.05)) {
    return LANGUAGE.progress.direction_values.improving;
  }
  if (t.includes("down") || t.includes("declin") || (momentum != null && momentum < -0.05)) {
    return LANGUAGE.progress.direction_values.declining;
  }
  return LANGUAGE.progress.direction_values.stable;
}

export function SystemStateStrip({
  conditionLabel,
  signals,
  showRawNumbers = false,
}: {
  conditionLabel: string;
  signals: SignalSummaryStrip;
  showRawNumbers?: boolean;
}) {
  const rate = signals.completionRate;
  const mom = momentumLabel(signals.trend, signals.momentum);
  const MomIcon =
    mom === LANGUAGE.progress.direction_values.declining
      ? TrendingDown
      : mom === LANGUAGE.progress.direction_values.improving
        ? TrendingUp
        : Minus;

  return (
    <section
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ECECF4] bg-white px-4 py-3 text-sm"
      aria-label="Execution state summary"
    >
      <span className="font-semibold text-[#0B1220]">{conditionLabel}</span>
      <span className="text-[#CBD5E1]">·</span>
      {rate != null ? (
        <>
          <span className="text-[#64748B]">
            {LANGUAGE.progress.completionRate}
            {showRawNumbers ? `: ${Math.round(rate * (rate <= 1 ? 100 : 1))}%` : ""}
          </span>
          <span className="text-[#CBD5E1]">·</span>
        </>
      ) : null}
      <span className="inline-flex items-center gap-1 text-[#64748B]">
        <MomIcon className="h-4 w-4" aria-hidden />
        {mom}
      </span>
      {signals.label ? (
        <>
          <span className="text-[#CBD5E1]">·</span>
          <span className="text-[#64748B]">{signals.label}</span>
        </>
      ) : null}
    </section>
  );
}
