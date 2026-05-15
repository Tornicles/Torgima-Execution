export function FeasibilityScoreCard({
  score,
  verdict,
  tabsFeasibility,
}: {
  score?: number;
  verdict?: string;
  tabsFeasibility?: Record<string, string | string[]>;
}) {
  const displayScore = score ?? Number(tabsFeasibility?.feasibilityScore ?? NaN);
  if (Number.isNaN(displayScore) && !tabsFeasibility) return null;

  const pct = Math.min(100, Math.max(0, displayScore));
  const barColor =
    pct >= 70 ? "bg-emerald-500"
    : pct >= 50 ? "bg-amber-500"
    : pct >= 30 ? "bg-orange-500"
    : "bg-red-500";

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-gray-900">Feasibility</h4>
        {verdict && (
          <span className="text-xs font-medium text-gray-500 capitalize">{verdict}</span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-gray-900">{Math.round(pct)}</span>
        <span className="text-sm text-gray-500 mb-1">/ 100</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {tabsFeasibility && (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(tabsFeasibility)
            .filter(([k]) => k !== "feasibilityScore")
            .slice(0, 4)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-gray-400 uppercase">{k.replace(/([A-Z])/g, " $1")}</dt>
                <dd className="text-gray-800 font-medium">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </dd>
              </div>
            ))}
        </dl>
      )}
    </div>
  );
}
