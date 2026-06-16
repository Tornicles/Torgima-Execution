import { freshnessFromAgeMs } from "@/lib/signals-panel";
import { LANGUAGE } from "@/lib/language";
import type { FreshnessState } from "@/types/signals-panel";

const BADGE_CLASS: Record<FreshnessState, string> = {
  live: "bg-emerald-50 text-emerald-800 border-emerald-200",
  recent: "bg-sky-50 text-sky-800 border-sky-200",
  warming: "bg-slate-50 text-slate-700 border-slate-200",
  stale: "bg-amber-50 text-amber-900 border-amber-200 cursor-pointer",
  outdated: "bg-amber-50 text-amber-900 border-amber-200 cursor-pointer",
  updating: "bg-violet-50 text-violet-800 border-violet-200",
};

export function StateFreshnessBadge({
  lastFetchedAt,
  pendingSync,
  onRefresh,
}: {
  lastFetchedAt?: number;
  pendingSync: boolean;
  onRefresh?: () => void;
}) {
  const ageMs = lastFetchedAt ? Date.now() - lastFetchedAt : Number.POSITIVE_INFINITY;
  const state = freshnessFromAgeMs(ageMs, pendingSync);
  const label = LANGUAGE.signalsPanel.freshness[state];
  const clickable = (state === "stale" || state === "outdated") && onRefresh;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onRefresh : undefined}
      className={`text-sm border rounded-lg px-3 py-2 font-medium ${BADGE_CLASS[state]} ${clickable ? "hover:opacity-90" : ""}`}
      aria-live="polite"
    >
      {label}
    </button>
  );
}
