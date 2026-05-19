export interface StrategicOutlookVm {
  executionForecast?: string;
  riskFactors?: Array<{ risk?: string; likelihood?: string; mitigation?: string }>;
  opportunityFlags?: string[];
  highestLeverageAction?: string;
  conditionPrediction?: string;
  momentumTrajectory?: string;
  confidenceTier?: string;
}

export function StrategicOutlookPanel({ outlook }: { outlook?: StrategicOutlookVm | null }) {
  if (!outlook) return null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Execution Trajectory</p>
        <span className="text-[10px] font-bold uppercase rounded-full bg-gray-100 text-gray-700 px-2 py-1">
          Pattern confidence: {outlook.confidenceTier ?? "LOW"}
        </span>
      </div>
      <p className="text-sm text-gray-800 leading-relaxed">{outlook.executionForecast}</p>
      <div className="rounded-xl bg-green-50 border border-green-100 p-3">
        <p className="text-[10px] font-bold uppercase text-green-700">Highest leverage action</p>
        <p className="text-sm text-green-950 mt-1">{outlook.highestLeverageAction}</p>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-gray-700">Risk factors and execution windows</summary>
        <div className="mt-3 space-y-3">
          {(outlook.riskFactors ?? []).map((r) => (
            <div key={r.risk} className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-sm font-medium text-amber-950">{r.risk}</p>
              <p className="text-xs text-amber-800 mt-1">{r.mitigation}</p>
            </div>
          ))}
          {(outlook.opportunityFlags ?? []).map((flag) => (
            <p key={flag} className="text-xs text-gray-600">Execution window open: {flag}</p>
          ))}
        </div>
      </details>
    </section>
  );
}
