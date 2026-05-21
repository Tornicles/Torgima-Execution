import { useEffect, useState } from "react";
import { apiGet } from "@/lib/torgima-api";

interface LoopEvent {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  status: string;
  createdAt: string;
}

const LOOP_EVENT_TYPES = new Set([
  "feedback_submitted",
  "signal_recalculation_requested",
  "signal_calculated",
  "condition_evaluated",
  "enforcement_package_created",
  "task_generation_requested",
  "task_generation_completed",
  "order_available",
  "queue_empty_detected",
  "interrogation_answered",
  "operating_loop_stage",
]);

export function ExecutionLoopTimeline({ blueprintId }: { blueprintId?: string | null }) {
  const [events, setEvents] = useState<LoopEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!blueprintId) return;
    setLoading(true);
    void apiGet<{ events?: LoopEvent[] }>(`/api/blueprints/${blueprintId}/execution-feed?limit=40`)
      .then((body) => {
        if (body?.events) {
          const filtered = body.events.filter((e) => LOOP_EVENT_TYPES.has(e.eventType));
          setEvents(filtered);
        }
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [blueprintId]);

  if (!blueprintId) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Execution loop</h3>
        <span className="text-[10px] uppercase text-slate-400 font-medium">Live trace</span>
      </div>
      {loading && <p className="text-xs text-slate-500">Loading loop events…</p>}
      {!loading && events.length === 0 && (
        <p className="text-xs text-slate-500">No loop events yet — execute an Order to start the chain.</p>
      )}
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 w-2 h-2 mt-1 rounded-full bg-emerald-500" />
            <div>
              <p className="font-medium text-slate-800">{e.eventType.replace(/_/g, " ")}</p>
              <p className="text-slate-400">{new Date(e.createdAt).toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
