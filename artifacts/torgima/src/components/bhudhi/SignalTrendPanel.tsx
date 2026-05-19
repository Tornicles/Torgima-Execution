export interface SignalNarrativeVm {
  narrativeText?: string;
  keyTrend?: string;
  momentumStatus?: string;
  sparkline?: number[];
}

export function SignalTrendPanel({ signals }: { signals?: SignalNarrativeVm | null }) {
  if (!signals) return null;
  const spark = signals.sparkline ?? [];
  const max = Math.max(1, ...spark);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Momentum trajectory</p>
      <p className="text-sm font-medium text-gray-900">{signals.keyTrend}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{signals.narrativeText}</p>
      {spark.length > 0 ? (
        <div className="flex items-end gap-1 h-12" aria-label="14-day signal movement">
          {spark.map((v, i) => (
            <div
              key={`${v}-${i}`}
              className="flex-1 rounded-t bg-green-500/70"
              style={{ height: `${Math.max(10, (v / max) * 48)}px` }}
            />
          ))}
        </div>
      ) : null}
      <p className="text-xs text-gray-500">Signal movement: {signals.momentumStatus}</p>
    </section>
  );
}
