export interface EconomyIntelligenceVm {
  archetypeName?: string | null;
  realityScore?: number | null;
  warning?: string | null;
  opportunity?: string | null;
  reportHref?: string;
}

export function EconomyIntelligencePanel({ intelligence }: { intelligence?: EconomyIntelligenceVm | null }) {
  if (!intelligence?.archetypeName && intelligence?.realityScore == null) return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Economy Intelligence</p>
          <h3 className="mt-1 text-base font-bold text-gray-950">{intelligence.archetypeName ?? "Economy context loaded"}</h3>
        </div>
        {intelligence.realityScore != null ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">
            Reality Score {intelligence.realityScore.toFixed(1)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Key warning</p>
          <p className="mt-1 text-xs leading-5 text-gray-700">{intelligence.warning ?? "No critical economy warning available."}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">Key opportunity</p>
          <p className="mt-1 text-xs leading-5 text-gray-700">{intelligence.opportunity ?? "Use a narrow proof wedge before expanding."}</p>
        </div>
      </div>

      {intelligence.reportHref ? (
        <a href={intelligence.reportHref} className="mt-4 inline-flex text-xs font-semibold text-blue-700 hover:text-blue-900">
          View Full Report
        </a>
      ) : null}
    </section>
  );
}
