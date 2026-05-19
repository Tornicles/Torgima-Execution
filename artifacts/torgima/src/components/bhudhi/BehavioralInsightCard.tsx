export interface BehavioralInsightVm {
  insightType?: string;
  insightText?: string;
  evidenceSummary?: string;
  actionSuggestion?: string;
}

export function BehavioralInsightCard({ insight }: { insight?: BehavioralInsightVm | null }) {
  if (!insight) return null;
  return (
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">Execution pattern detected</p>
        <span className="text-[10px] font-bold uppercase rounded-full bg-white text-indigo-800 px-2 py-1">
          {insight.insightType ?? "PATTERN"}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900">{insight.insightText}</p>
      <p className="text-xs text-gray-600">Signal evidence shows: {insight.evidenceSummary}</p>
      {insight.actionSuggestion ? (
        <p className="text-xs text-indigo-900 bg-white border border-indigo-100 rounded-xl p-3">
          Execution opportunity: {insight.actionSuggestion}
        </p>
      ) : null}
    </section>
  );
}
