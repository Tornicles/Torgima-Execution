import { ConditionState } from "@workspace/state-machine";

interface HierarchyPlan {
  id: string;
  name: string;
  completionPct: number;
  phases: Array<{ id: string; name: string; status: string }>;
}

export function DomainContextBanner({
  domain,
  missionSummary,
}: {
  domain?: string | null;
  missionSummary?: string | null;
}) {
  if (!domain && !missionSummary) return null;
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Domain context</p>
      {domain && <p className="text-sm font-semibold text-indigo-950 capitalize mt-1">{domain.replace(/_/g, " ")}</p>}
      {missionSummary && <p className="text-xs text-indigo-800 mt-1 line-clamp-2">{missionSummary}</p>}
    </div>
  );
}

export function OperationalStateIndicator({ condition }: { condition?: string | null }) {
  const c = (condition ?? ConditionState.NOTHINGNESS).toLowerCase();
  const colors: Record<string, string> = {
    [ConditionState.POWER]: "bg-violet-600",
    [ConditionState.STABILITY]: "bg-emerald-600",
    [ConditionState.URGENCY]: "bg-amber-600",
    [ConditionState.DANGER]: "bg-red-600",
    [ConditionState.NOTHINGNESS]: "bg-slate-500",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[c] ?? colors[ConditionState.NOTHINGNESS]}`} />
      <span className="text-xs font-semibold text-slate-700 capitalize">{c}</span>
    </div>
  );
}

export function ExecutionProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-500 font-medium uppercase">
        <span>Execution progress</span>
        <span>{Math.round(clamped)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-slate-900 rounded-full transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function HierarchyNavigator({ plans }: { plans: HierarchyPlan[] }) {
  if (!plans.length) return null;
  return (
    <nav className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 max-h-48 overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hierarchy</p>
      {plans.slice(0, 4).map((plan) => (
        <div key={plan.id} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-medium text-slate-900 truncate">{plan.name}</span>
            <span className="text-xs text-slate-500 shrink-0">{plan.completionPct}%</span>
          </div>
          {plan.phases.length > 0 && (
            <ul className="mt-1 ml-2 border-l border-slate-200 pl-2 space-y-0.5">
              {plan.phases.slice(0, 3).map((ph) => (
                <li key={ph.id} className="text-xs text-slate-600 truncate">
                  {ph.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}

export function BlueprintExecutionContext({
  domain,
  condition,
  progressPct,
  missionSummary,
  hierarchy,
}: {
  domain?: string | null;
  condition?: string | null;
  progressPct: number;
  missionSummary?: string | null;
  hierarchy: HierarchyPlan[];
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <DomainContextBanner domain={domain} missionSummary={missionSummary} />
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operational state</p>
        <OperationalStateIndicator condition={condition} />
        <ExecutionProgressBar pct={progressPct} />
      </div>
      <div className="sm:col-span-2 lg:col-span-2">
        <HierarchyNavigator plans={hierarchy} />
      </div>
    </section>
  );
}
