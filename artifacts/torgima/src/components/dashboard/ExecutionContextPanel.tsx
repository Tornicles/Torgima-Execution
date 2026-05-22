import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface ExecutionContextVm {
  archetypeName: string | null;
  realityScore: number;
  blueprintTier: string | null;
  industryState: string | null;
  economyBriefingSummary: string | null;
}

function formatTierBadge(tier: string | null): string {
  if (!tier) return "STARTER";
  const t = tier.toLowerCase();
  if (t === "growth") return "GROWTH";
  if (t === "ultimate") return "ULTIMATE";
  return t.toUpperCase();
}

/** Prompt 6 — locked archetype intelligence on dashboard (read-only, collapsed by default). */
export function ExecutionContextPanel({ context }: { context?: ExecutionContextVm | null }) {
  const [open, setOpen] = useState(false);

  if (!context?.archetypeName || context.realityScore == null) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/80 transition-colors">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Execution Context</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{context.archetypeName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-600">
              Reality Score: {context.realityScore.toFixed(1)} / 10
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 pt-0 space-y-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <span className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                {formatTierBadge(context.blueprintTier)}
              </span>
              {context.industryState ? (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  {context.industryState.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
            {context.economyBriefingSummary ? (
              <p className="text-xs leading-5 text-slate-600 line-clamp-2">{context.economyBriefingSummary}</p>
            ) : null}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
