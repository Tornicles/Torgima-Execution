import { useEffect, useState } from "react";
import { ConditionBadge } from "@workspace/design-system";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import { BLUEPRINT_LABELS, DEFAULT_CONDITION } from "@/lib/language-map";

type ConditionResponse = {
  display?: {
    label: string;
    emoji?: string;
    colorKey?: string;
    summary?: string;
    transitionMessage?: string;
    dailyTasksAllowed?: number;
    miniPlanAllocation?: { Foundation: number; Operations: number; Growth: number };
    canProgress?: boolean;
    canScale?: boolean;
    recoveryRequired?: boolean;
    recoveryTaskTypes?: string[];
  };
  frameworkSignals?: {
    Production: number;
    Operations: number;
    Growth: number;
    Scale: number;
  };
  condition?: { durationDays?: number };
};

export function ConditionStatusPanel({ blueprintId }: { blueprintId?: string | null }) {
  const [data, setData] = useState<ConditionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!blueprintId) return;
    setLoading(true);
    void apiFetchEnvelope<ConditionResponse>(
      `/api/condition/current?blueprintId=${encodeURIComponent(blueprintId)}`,
    ).then((res) => {
      setLoading(false);
      if (res.ok && res.data) setData(res.data);
    });
  }, [blueprintId]);

  if (!blueprintId) return null;
  if (loading && !data?.display) {
    return <p className="text-sm text-muted-foreground">Loading {BLUEPRINT_LABELS.conditions.toLowerCase()}…</p>;
  }

  const display = data?.display;
  if (!display) return null;

  const alloc = display.miniPlanAllocation;
  const conditionKey = display.colorKey ?? DEFAULT_CONDITION;

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card p-4 space-y-3 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {BLUEPRINT_LABELS.conditions}
      </p>
      <ConditionBadge
        condition={conditionKey}
        label={display.label}
        emoji={display.emoji}
      />
      <p className="text-sm text-muted-foreground">
        {display.transitionMessage ?? display.summary}
      </p>
      {data?.frameworkSignals && (
        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
          <span>Production {(data.frameworkSignals.Production * 100).toFixed(0)}%</span>
          <span>Operations {(data.frameworkSignals.Operations * 100).toFixed(0)}%</span>
          <span>Growth {(data.frameworkSignals.Growth * 100).toFixed(0)}%</span>
          <span>Scale {(data.frameworkSignals.Scale * 100).toFixed(0)}%</span>
        </div>
      )}
      <ul className="text-xs text-muted-foreground space-y-1">
        <li>{display.dailyTasksAllowed} daily tasks allowed</li>
        {alloc && (
          <li>
            Foundation {alloc.Foundation}% · Operations {alloc.Operations}% · Growth {alloc.Growth}%
          </li>
        )}
        <li>{display.canProgress ? "Progression enabled" : "Progression paused"}</li>
        <li>{display.canScale ? "Scaling available" : "Scaling restricted"}</li>
        {display.recoveryRequired && display.recoveryTaskTypes && display.recoveryTaskTypes.length > 0 && (
          <li>Recovery focus: {display.recoveryTaskTypes.join(", ")}</li>
        )}
      </ul>
      {data?.condition?.durationDays != null && (
        <p className="text-[10px] text-muted-foreground">
          In this condition for {data.condition.durationDays} day(s)
        </p>
      )}
    </section>
  );
}
