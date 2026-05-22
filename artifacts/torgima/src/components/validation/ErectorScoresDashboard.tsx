const SCORE_LABELS: Array<{ key: string; label: string; inverse?: boolean }> = [
  { key: "marketScore", label: "Market" },
  { key: "executionScore", label: "Execution" },
  { key: "timingScore", label: "Timing" },
  { key: "competitionScore", label: "Competition" },
  { key: "scalabilityScore", label: "Scalability" },
  { key: "localEconomyScore", label: "Local economy" },
  { key: "resourceScore", label: "Resources" },
  { key: "blueprintDifficultyScore", label: "Blueprint difficulty" },
  { key: "riskScore", label: "Risk", inverse: true },
  { key: "momentumPotential", label: "Momentum" },
  { key: "trustBuildingScore", label: "Trust building" },
];

function scoreColor(value: number, inverse?: boolean): string {
  const effective = inverse ? 10 - value : value;
  if (effective >= 7) return "bg-emerald-500";
  if (effective >= 4) return "bg-amber-500";
  return "bg-red-500";
}

export function ErectorScoresDashboard({
  scores,
  realityScore,
  verdict,
  recommendedBlueprintLevel,
}: {
  scores?: Record<string, number | string | undefined>;
  realityScore?: number;
  verdict?: string;
  recommendedBlueprintLevel?: string;
}) {
  if (!scores) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border border-gray-200 rounded-2xl p-4 bg-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Reality Score</p>
          <p className="text-3xl font-bold text-gray-900">{realityScore ?? scores.realityScore ?? "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase font-semibold">Verdict</p>
          <p className="text-sm font-semibold capitalize text-gray-900">{verdict ?? scores.verdict ?? "—"}</p>
          {recommendedBlueprintLevel && (
            <p className="text-xs text-gray-500 mt-1">Blueprint level: {recommendedBlueprintLevel}</p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {SCORE_LABELS.map(({ key, label, inverse }) => {
          const raw = scores[key];
          const value = typeof raw === "number" ? raw : Number(raw);
          if (Number.isNaN(value)) return null;
          const pct = Math.max(0, Math.min(100, value * 10));
          return (
            <div key={key} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="text-gray-500">{value.toFixed(1)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreColor(value, inverse)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
