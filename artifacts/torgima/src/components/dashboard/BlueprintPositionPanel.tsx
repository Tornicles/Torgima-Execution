import type { DashboardProjection } from "@/lib/dashboard-types";
import { getPlanLabel, LANGUAGE } from "@/lib/language";

type Position = NonNullable<DashboardProjection["blueprintPosition"]>;

export function BlueprintPositionPanel({ position }: { position: Position }) {
  const p = position.progressSummary;
  const plan = position.currentPlan;
  const target = position.currentTarget;
  const phase = position.currentPhase;
  const project = position.currentProject;
  const action = position.currentAction;

  const planLabel = plan
    ? `${getPlanLabel(plan.name)} (${plan.sequenceNumber} of ${Math.max(p.plansTotal, plan.sequenceNumber)})`
    : "—";
  const phaseLabel = phase
    ? `${phase.name} (${p.phasesCompleted + 1} of ${Math.max(p.phasesTotal, 1)})`
    : "—";

  return (
    <div className="rounded-[20px] border border-[#E8ECF0] bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
          {LANGUAGE.project.position}
        </p>
        <p className="text-xs text-[#94A3B8] mt-0.5 capitalize">Tier: {position.tier}</p>
      </div>

      <dl className="grid gap-2 text-sm">
        <Row label="Phase" value={planLabel} />
        <Row label={LANGUAGE.hierarchy.goalMilestone} value={target?.name ?? "—"} />
        <Row label={LANGUAGE.hierarchy.stage} value={phaseLabel} />
        <Row label={LANGUAGE.hierarchy.sprint} value={project?.name ?? "—"} />
        <Row
          label={LANGUAGE.hierarchy.step}
          value={action?.name ?? "—"}
          detail={action?.instruction?.slice(0, 120)}
        />
      </dl>

      <div className="space-y-2 pt-2 border-t border-[#E8ECF0]">
        <div className="flex justify-between text-xs font-semibold text-[#64748B]">
          <span>Progress overview</span>
          <span>{p.percentComplete}% complete</span>
        </div>
        <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#5B21FF] transition-all"
            style={{ width: `${Math.min(100, p.percentComplete)}%` }}
          />
        </div>
        <p className="text-[11px] text-[#64748B] font-mono">
          Plans: {p.plansCompleted}/{p.plansTotal} | Phases: {p.phasesCompleted}/{p.phasesTotal} | Actions:{" "}
          {p.actionsCompleted}/{p.actionsTotal}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</dt>
      <dd className="font-medium text-[#0F172A]">{value}</dd>
      {detail ? <dd className="text-xs text-[#64748B] mt-0.5">{detail}</dd> : null}
    </div>
  );
}
