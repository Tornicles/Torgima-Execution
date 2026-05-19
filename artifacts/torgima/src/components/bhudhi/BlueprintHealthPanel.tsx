export interface BlueprintHealthVm {
  healthScore?: number;
  status?: string;
  agentAssessment?: string;
  governanceSummary?: { pendingCount?: number; highestPriority?: string | null };
}

export function BlueprintHealthPanel({ health }: { health?: BlueprintHealthVm | null }) {
  if (!health) return null;
  const score = Math.round((health.healthScore ?? 0.5) * 100);
  const pending = health.governanceSummary?.pendingCount ?? 0;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Blueprint health</p>
        {pending > 0 ? (
          <span className="text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-800 px-2 py-1">
            {pending} governance actions
          </span>
        ) : null}
      </div>
      <p className="text-lg font-bold text-gray-900">{health.status ?? "Blueprint health: Active"}</p>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-gray-600">Execution continuity: {health.agentAssessment ?? "Active"}</p>
      {pending > 0 ? (
        <p className="text-xs text-amber-800">Phase advancement ready checks include pending evidence-based recommendations.</p>
      ) : null}
    </section>
  );
}
