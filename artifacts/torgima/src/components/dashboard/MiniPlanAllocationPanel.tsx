import { useEffect, useState } from "react";
import { apiFetchEnvelope } from "@/lib/torgima-api";

type AllocationData = {
  condition: string;
  allocation: { Foundation: number; Operations: number; Growth: number };
  dailyTaskCounts: { Foundation: number; Operations: number; Growth: number };
  dailyTotal: number;
  todayPattern?: string[];
  display?: {
    tagline: string;
    foundationSub: string;
    operationsSub: string;
    growthSub: string;
  };
  adaptsAutomatically?: boolean;
  history?: Array<{
    condition: string;
    previousCondition?: string | null;
    tasksAffected?: number;
    date?: string;
  }>;
};

type QueuePreview = {
  today: string[];
  nextSevenDays: Array<{ day: string; pattern: string[] }>;
  note?: string;
};

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function PatternRow({ label, pattern }: { label: string; pattern: string[] }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="tracking-widest">{pattern.join(" ") || "—"}</span>
    </div>
  );
}

export function MiniPlanAllocationPanel({ blueprintId }: { blueprintId?: string | null }) {
  const [data, setData] = useState<AllocationData | null>(null);
  const [queue, setQueue] = useState<QueuePreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!blueprintId) return;
    setLoading(true);
    const q = encodeURIComponent(blueprintId);
    void Promise.all([
      apiFetchEnvelope<AllocationData>(`/api/mini-plans/allocation?blueprintId=${q}`),
      apiFetchEnvelope<QueuePreview>(`/api/mini-plans/queue-preview?blueprintId=${q}`),
    ]).then(([allocRes, queueRes]) => {
      setLoading(false);
      if (allocRes.ok && allocRes.data) setData(allocRes.data);
      if (queueRes.ok && queueRes.data) setQueue(queueRes.data);
    });
  }, [blueprintId]);

  if (!blueprintId) return null;
  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading allocation…</p>;
  }
  if (!data) return null;

  const subs = data.display ?? {
    foundationSub: "Build core capability",
    operationsSub: "Execute daily work",
    growthSub: "Learn and improve",
    tagline: "Allocation adapts to your execution condition.",
  };

  const rows = [
    { key: "Foundation" as const, label: "Foundation", sub: subs.foundationSub, pct: data.allocation.Foundation },
    { key: "Operations" as const, label: "Operations", sub: subs.operationsSub, pct: data.allocation.Operations },
    { key: "Growth" as const, label: "Growth", sub: subs.growthSub, pct: data.allocation.Growth },
  ];

  const todayPattern = queue?.today ?? data.todayPattern ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Mini plan allocation</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Condition: <span className="font-medium uppercase">{data.condition.replace(/_/g, " ")}</span>
          {data.adaptsAutomatically !== false && " — adapts automatically (not user-editable)."}
        </p>
        {subs.tagline && <p className="text-xs text-muted-foreground mt-2">{subs.tagline}</p>}
      </div>

      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">
              {r.label} ({data.allocation[r.key]}%)
            </span>
            <span className="text-muted-foreground">
              {data.dailyTaskCounts[r.key]} / {data.dailyTotal} tasks/day
            </span>
          </div>
          <Bar percent={r.pct} />
          <p className="text-xs text-muted-foreground mt-1">{r.sub}</p>
        </div>
      ))}

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Task queue</p>
        <PatternRow label="Today" pattern={todayPattern} />
        {(queue?.nextSevenDays ?? []).slice(0, 3).map((d) => (
          <PatternRow key={d.day} label={d.day} pattern={d.pattern} />
        ))}
        {(queue?.nextSevenDays?.length ?? 0) > 3 && (
          <p className="text-[10px] text-muted-foreground">
            +{(queue?.nextSevenDays?.length ?? 0) - 3} more hidden days…
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {queue?.note ??
            "If condition changes, tomorrow's hidden queue regenerates with the new mix."}
        </p>
      </div>

      {data.history && data.history.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Recent changes
          </p>
          <ul className="text-[10px] text-muted-foreground space-y-1">
            {data.history.slice(0, 3).map((h, i) => (
              <li key={i}>
                {h.previousCondition ? `${h.previousCondition} → ` : ""}
                <span className="font-medium">{h.condition}</span>
                {h.tasksAffected != null && h.tasksAffected > 0
                  ? ` · ${h.tasksAffected} hidden tasks regenerated`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
