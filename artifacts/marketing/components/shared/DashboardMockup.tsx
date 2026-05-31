import { Badge } from "./Badge";
import { SignalStrip } from "@workspace/design-system";

export type MockVariant = "dashboard" | "validator" | "tasks" | "structure" | "signals";

export function DashboardMockup({ variant = "dashboard" }: { variant?: MockVariant }) {
  return (
    <div className="relative mx-auto max-w-4xl rounded-2xl border border-dark-border bg-dark-card p-1 shadow-2xl shadow-primary/20">
      <div className="rounded-xl bg-[#120a1c] p-4 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Project</p>
            <p className="font-syne font-bold text-lg text-white">My Creator Business System</p>
          </div>
          <Badge tone="green">Strong Execution</Badge>
        </div>

        {variant === "validator" ? (
          <ValidatorMock />
        ) : variant === "tasks" ? (
          <TasksMock />
        ) : variant === "structure" ? (
          <StructureMock />
        ) : variant === "signals" ? (
          <SignalsMock />
        ) : (
          <DashboardMock />
        )}
      </div>
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-b from-primary-bright/20 to-transparent opacity-60 -z-10 blur-xl" />
    </div>
  );
}

function DashboardMock() {
  const tasks = [
    { title: "Define your core offer in one sentence", diff: "Easy", time: "25 min" },
    { title: "Research 5 creators in your niche on YouTube", diff: "Medium", time: "45 min" },
    { title: "Draft your first lead magnet outline", diff: "Medium", time: "40 min" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <SignalStrip
          signals={{
            completionRate: 0.68,
            weightedScore: 7.2,
            momentum: 12,
            direction: "↑ Improving",
          }}
        />
      </div>
      <div className="lg:col-span-2 space-y-3">
        <p className="text-xs font-bold text-zinc-400 uppercase">Today&apos;s Tasks</p>
        {tasks.map((t) => (
          <div
            key={t.title}
            className="rounded-lg border border-dark-border bg-dark/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm font-medium text-white">{t.title}</span>
            <span className="text-[10px] text-zinc-500">
              {t.diff} · {t.time}
            </span>
          </div>
        ))}
        <p className="text-[10px] text-zinc-600">+ 5 more tasks ready</p>
      </div>
    </div>
  );
}

function ValidatorMock() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <div className="relative h-24 w-24 rounded-full border-4 border-emerald-500 flex items-center justify-center">
          <span className="font-jet text-2xl font-bold text-emerald-400">78%</span>
        </div>
        <div>
          <p className="font-syne text-xl font-bold text-emerald-400">✓ Go For It</p>
          <p className="text-sm text-zinc-400 mt-1">Idea Strength Score</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-xs">
        {["Competitor A", "Competitor B", "Competitor C"].map((c) => (
          <div key={c} className="rounded-lg border border-dark-border p-3">
            <p className="font-semibold text-white">{c}</p>
            <p className="text-zinc-500 mt-1">Gap: positioning</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksMock() {
  return (
    <div className="rounded-xl border border-primary-bright/40 p-5 space-y-4">
      <p className="font-syne font-bold text-white">Define your proof-of-concept landing page</p>
      <p className="text-sm text-zinc-400 leading-relaxed">
        Write a single-page outline with headline, 3 benefits, and one CTA. Save it in Notion or Google
        Docs.
      </p>
      <div className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-500">
        <span>Definition of done: outline with 5 sections</span>
        <span>~35 min · Challenging</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function StructureMock() {
  const stages = [
    { name: "Foundation", status: "done", sprints: 2 },
    { name: "Validation", status: "active", sprints: 3 },
    { name: "Growth", status: "locked", sprints: 4 },
    { name: "Scale", status: "locked", sprints: 3 },
  ];
  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div
          key={s.name}
          className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
            s.status === "active"
              ? "border-primary-bright/50 bg-primary/10"
              : "border-dark-border bg-dark/40"
          }`}
        >
          <div>
            <p className="font-medium text-white text-sm">{s.name}</p>
            <p className="text-[10px] text-zinc-500">{s.sprints} sprints · 12 steps</p>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            {s.status === "done" ? "✓ Complete" : s.status === "active" ? "In progress" : "Locked"}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-zinc-600 pt-2">Current step: Define monetization offer → Sprint 2</p>
    </div>
  );
}

function SignalsMock() {
  const states = ["Getting Started", "Steady Progress", "Strong Execution", "Peak Performance"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {states.map((s, i) => (
          <span
            key={s}
            className={`text-[10px] px-2 py-1 rounded-full border ${
              i === 2
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-dark-border text-zinc-500"
            }`}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Completion" value="82%" />
        <Row label="Quality" value="7.8" />
        <Row label="Streak" value="12 days" />
        <Row label="Direction" value="↑ Up" />
      </div>
      <p className="text-xs text-zinc-500 border-t border-dark-border pt-3">
        Condition: <span className="text-emerald-400 font-medium">Strong Execution</span> — 7 tasks today,
        Challenging difficulty
      </p>
    </div>
  );
}
