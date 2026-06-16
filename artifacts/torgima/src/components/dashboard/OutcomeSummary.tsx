import type { OutcomeSummaryData } from "@/types/dashboard";
import { BLUEPRINT_LABELS } from "@/lib/language-map";

/** DOC 33 — outcome truth summary from DashboardProjection.outcomeIntegrity. */
export function OutcomeSummary({ outcome }: { outcome?: OutcomeSummaryData }) {
  if (!outcome) return null;

  return (
    <section className="rounded-2xl border border-[#ECECF4] bg-white p-4" aria-label="Outcome summary">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
        {BLUEPRINT_LABELS.feedback} truth
      </p>
      {outcome.openFlagCount > 0 ? (
        <p className="mt-2 text-sm text-amber-800">
          {outcome.openFlagCount} open review{outcome.openFlagCount === 1 ? "" : "s"} need attention.
        </p>
      ) : (
        <p className="mt-2 text-sm text-[#64748B]">No open outcome flags.</p>
      )}
      {!outcome.canAdvancePhase ? (
        <p className="mt-2 text-xs text-[#94A3B8]">Phase advancement is on hold until outcomes are verified.</p>
      ) : null}
      {outcome.blockers.length > 0 ? (
        <ul className="mt-2 text-xs text-[#64748B] list-disc pl-4">
          {outcome.blockers.slice(0, 3).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
