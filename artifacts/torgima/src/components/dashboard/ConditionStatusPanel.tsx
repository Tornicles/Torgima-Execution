import { useEffect, useState } from "react";
import { apiFetchEnvelope } from "@/lib/torgima-api";

type ConditionDisplay = {
  condition: string;
  label: string;
  emoji: string;
  colorKey: string;
  summary: string;
  dailyTasksAllowed: number;
  canProgress: boolean;
  canScale: boolean;
  recoveryRequired?: boolean;
  transitionMessage?: string;
  restrictedActions?: string[];
  recoveryTaskTypes?: string[];
  miniPlanAllocation: { Foundation: number; Operations: number; Growth: number };
};

type ConditionResponse = {
  display?: ConditionDisplay | null;
  frameworkSignals?: Record<string, number> | null;
  condition?: { condition?: string; durationDays?: number } | null;
};

const COLOR_RING: Record<string, string> = {
  danger: "ring-red-400 bg-red-50 text-red-800",
  urgency: "ring-amber-400 bg-amber-50 text-amber-900",
  stability: "ring-emerald-400 bg-emerald-50 text-emerald-900",
  power: "ring-blue-400 bg-blue-50 text-blue-900",
  neutral: "ring-slate-300 bg-slate-50 text-slate-800",
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
    return <p className="text-sm text-muted-foreground">Loading condition…</p>;
  }

  const display = data?.display;
  if (!display) return null;

  const ring = COLOR_RING[display.colorKey] ?? COLOR_RING.neutral;
  const alloc = display.miniPlanAllocation;

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Execution condition
      </p>
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${ring}`}>
        <span>{display.emoji}</span>
        <span>{display.label}</span>
      </div>
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
        <li>
          Foundation {alloc.Foundation}% · Operations {alloc.Operations}% · Growth {alloc.Growth}%
        </li>
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
