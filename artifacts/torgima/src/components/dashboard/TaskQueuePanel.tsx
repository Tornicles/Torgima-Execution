import { useEffect, useState } from "react";
import { apiFetchEnvelope } from "@/lib/torgima-api";

type QueueSnapshot = {
  visibleToday: Array<{ id: string; title: string; miniPlanKey: string | null; status: string }>;
  hiddenCount: number;
  hiddenByDay?: Array<{ dayOffset: number; dateKey: string; pattern: string[] }>;
  horizonDays: number;
  dailyTotal: number;
  condition?: string;
  todayPattern?: string[];
  visiblePattern?: string[];
  dailyTaskCounts?: { Foundation: number; Operations: number; Growth: number };
  principles?: { visibleQueue: string; hiddenQueue: string; neverRunsOut: boolean };
};

function PatternLine({ label, pattern }: { label: string; pattern: string[] }) {
  return (
    <div className="flex gap-2 text-xs font-mono">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="tracking-widest">{pattern.join(" ") || "—"}</span>
    </div>
  );
}

export function TaskQueuePanel({ blueprintId }: { blueprintId?: string | null }) {
  const [data, setData] = useState<QueueSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!blueprintId) return;
    setLoading(true);
    void apiFetchEnvelope<QueueSnapshot>(
      `/api/tasks/queue?blueprintId=${encodeURIComponent(blueprintId)}`,
    ).then((res) => {
      setLoading(false);
      if (res.ok && res.data) setData(res.data);
    });
  }, [blueprintId]);

  if (!blueprintId) return null;
  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading task queue…</p>;
  }
  if (!data) return null;

  const today = data.visiblePattern?.length
    ? data.visiblePattern
    : data.todayPattern ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Task queue</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {data.visibleToday.length} visible today · {data.hiddenCount} hidden ·{" "}
          {data.horizonDays}-day horizon
        </p>
      </div>

      <PatternLine label="Today" pattern={today} />

      {data.hiddenByDay && data.hiddenByDay.length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hidden (next days)
          </p>
          {data.hiddenByDay.slice(0, 4).map((d) => (
            <PatternLine key={d.dayOffset} label={`+${d.dayOffset}d`} pattern={d.pattern} />
          ))}
        </div>
      )}

      {data.principles && (
        <p className="text-[10px] text-muted-foreground border-t border-border pt-2 leading-relaxed">
          {data.principles.visibleQueue}. {data.principles.hiddenQueue}.
          {data.principles.neverRunsOut && " Tasks never run out."}
        </p>
      )}
    </section>
  );
}
