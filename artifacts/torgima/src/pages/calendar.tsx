import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CalEvent = {
  id: string;
  title: string;
  eventType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priority: number;
  color: string;
  status: string;
  location?: string;
  locationCoordinates?: { lat: number; lng: number };
};

type ViewType = "calendar" | "kanban" | "gantt" | "list" | "board" | "table" | "dashboard" | "map";

const VIEW_OPTIONS: ViewType[] = [
  "calendar",
  "kanban",
  "list",
  "gantt",
  "board",
  "table",
  "dashboard",
  "map",
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function CalendarPage() {
  const [view, setView] = useState<ViewType>("calendar");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [kanban, setKanban] = useState<Record<string, CalEvent[]> | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [conflicts, setConflicts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 1);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 14);

  const load = useCallback(async () => {
    setLoading(true);
    setConflictMsg(null);
    try {
      const [evData, conflictData] = await Promise.all([
        apiGet<{
          events?: CalEvent[];
          columns?: Record<string, CalEvent[]>;
          summary?: Record<string, unknown>;
          view?: string;
        }>(
          `/api/calendar/events?view=${view}&startDate=${rangeStart.toISOString()}&endDate=${rangeEnd.toISOString()}`,
        ),
        apiGet<{ conflicts: unknown[] }>("/api/calendar/conflicts/unresolved"),
      ]);

      if (evData?.columns) {
        setKanban(evData.columns);
        setEvents([]);
      } else if (evData?.summary) {
        setDashboard(evData.summary);
        setEvents(evData.events ?? []);
      } else {
        setEvents(evData?.events ?? []);
        setKanban(null);
        setDashboard(null);
      }
      setConflicts(conflictData?.conflicts ?? []);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reschedule(eventId: string, hoursOffset: number) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const start = new Date(ev.startTime);
    const end = new Date(ev.endTime);
    start.setHours(start.getHours() + hoursOffset);
    end.setHours(end.getHours() + hoursOffset);

    try {
      await apiPut(`/api/calendar/events/${eventId}/reschedule`, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      await load();
    } catch {
      setConflictMsg("Reschedule blocked — time conflict. Pick another slot.");
    }
  }

  async function createBlock() {
    const start = new Date();
    start.setHours(start.getHours() + 2, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    try {
      await apiPost("/api/calendar/events", {
        eventType: "custom-block",
        title: "Focus block",
        sourceType: "custom",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        priority: 3,
      });
      await load();
    } catch {
      setConflictMsg("Could not create block — conflicts with existing events.");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Execution time</p>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Orders, study, and principle deadlines — conflict-aware scheduling.
          </p>
        </div>
        <Button size="sm" onClick={() => void createBlock()}>
          Add focus block
        </Button>
      </header>

      <div className="flex flex-wrap gap-1">
        {VIEW_OPTIONS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-xs rounded-full border capitalize ${
              view === v
                ? "bg-sky-100 border-sky-300 text-sky-900 font-semibold"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {conflictMsg ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {conflictMsg}
        </p>
      ) : null}

      {conflicts.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-900">
              {conflicts.length} unresolved conflict(s)
            </CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-400 font-mono">Loading calendar…</p>
      ) : view === "dashboard" && dashboard ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(dashboard).map(([k, v]) => (
            <Card key={k}>
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase">{k}</CardDescription>
                <CardTitle className="text-lg">{String(v)}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : view === "kanban" && kanban ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Object.entries(kanban).map(([col, items]) => (
            <div key={col} className="min-w-[200px] flex-1 bg-gray-50 rounded-xl p-3 border">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">{col}</h3>
              <div className="space-y-2">
                {items.map((e) => (
                  <div
                    key={e.id}
                    className="bg-white rounded-lg p-2 border text-sm shadow-sm"
                    style={{ borderLeftColor: e.color, borderLeftWidth: 4 }}
                  >
                    {e.title}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : view === "map" ? (
        <Card>
          <CardContent className="pt-4 text-sm text-gray-600">
            {events.filter((e) => e.locationCoordinates).length === 0
              ? "No geolocated events in range."
              : events
                  .filter((e) => e.locationCoordinates)
                  .map((e) => (
                    <p key={e.id}>
                      {e.title} — {e.location ?? "location set"}
                    </p>
                  ))}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">No events in this range. Sync an order or enroll in Academy study.</p>
          ) : (
            events.map((e) => (
              <li
                key={e.id}
                draggable
                onDragStart={() => setDragId(e.id)}
                onDragEnd={() => {
                  if (dragId === e.id) void reschedule(e.id, 1);
                  setDragId(null);
                }}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border rounded-xl p-3 bg-white hover:shadow-sm cursor-grab active:cursor-grabbing"
                style={{ borderLeftColor: e.color, borderLeftWidth: 4 }}
              >
                <div className="text-xs font-mono text-gray-500 shrink-0">
                  {formatDay(e.startTime)}
                  <br />
                  {formatTime(e.startTime)} – {formatTime(e.endTime)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{e.title}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {e.eventType} · P{e.priority} · {e.status}
                  </p>
                </div>
                <span
                  className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: `${e.color}22`, color: e.color }}
                >
                  {e.eventType}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      <p className="text-xs text-gray-400">
        Drag an event and release to shift +1 hour (conflict-checked). Notifications fire 15m, 1h, and 1d before start.
      </p>
    </div>
  );
}
