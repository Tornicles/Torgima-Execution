import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, ChevronDown, ChevronUp, Info, Lock, Star } from "lucide-react";
import { useGetBlueprintCommandCenter } from "@workspace/api-client-react";
import { useBlueprintStore } from "@/store/blueprintStore";
import { PageHeader } from "@/components/design-system/PageHeader";
import { StatCard } from "@/components/design-system/StatCard";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { DonutProgress } from "@/components/design-system/DonutProgress";

interface HierarchyProject {
  id: string;
  name: string;
  status: string;
  locked: boolean;
  progressionPctOrders?: number;
}

interface HierarchyPhase {
  id: string;
  name: string;
  status: string;
  lockedDb: boolean;
  gatePassed: boolean;
  strategicPurpose: string;
  progressionPctOrders: number;
  projects: HierarchyProject[];
}

interface HierarchyPlan {
  phases: HierarchyPhase[];
  completionPct: number;
}

interface CommandCenterPayload {
  blueprintId: string;
  mission?: { timeframeLabel?: string | null; progressionSummary?: string };
  hierarchy: HierarchyPlan[];
}

function phaseState(phase: HierarchyPhase, index: number, activeIdx: number): "completed" | "active" | "locked" {
  const s = phase.status.toLowerCase();
  if (s === "completed" || s === "done") return "completed";
  if (index === activeIdx || s === "active" || s === "in_progress") return "active";
  if (phase.lockedDb || !phase.gatePassed || index > activeIdx) return "locked";
  return "locked";
}

function projectStatus(p: HierarchyProject): "completed" | "in_progress" | "not_started" {
  const s = p.status.toLowerCase();
  if (s === "completed" || s === "done") return "completed";
  if (s === "active" || s === "in_progress") return "in_progress";
  return "not_started";
}

export function BlueprintOverviewView() {
  const [, setLocation] = useLocation();
  const blueprintId = useBlueprintStore((s) => s.activeBlueprintId);
  const dash = useBlueprintStore((s) => s.dashboardProjection);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: raw, isLoading, isError, refetch } = useGetBlueprintCommandCenter(blueprintId ?? "", {
    query: { enabled: Boolean(blueprintId) } as never,
  });

  const cc = raw as CommandCenterPayload | undefined;
  const phases = cc?.hierarchy?.[0]?.phases ?? [];

  const { activeIdx, overallPct, completedProjects, totalProjects } = useMemo(() => {
    let completed = 0;
    let total = 0;
    phases.forEach((ph) => {
      ph.projects.forEach((p) => {
        total += 1;
        if (projectStatus(p) === "completed") completed += 1;
      });
    });
    const explicitActive = phases.findIndex((ph) => {
      const s = ph.status.toLowerCase();
      return s === "active" || s === "in_progress";
    });
    const firstOpen =
      explicitActive >= 0
        ? explicitActive
        : phases.findIndex((ph) => ph.status.toLowerCase() !== "completed" && ph.status.toLowerCase() !== "done");
    const active = firstOpen >= 0 ? firstOpen : Math.max(0, phases.length - 1);
    const pct =
      cc?.hierarchy?.[0]?.completionPct ??
      (total > 0 ? Math.round((completed / total) * 100) : 0);
    return { activeIdx: active, overallPct: pct, completedProjects: completed, totalProjects: total };
  }, [phases, cc]);

  const activePhase = phases[activeIdx];
  const blueprintTitle =
    (dash?.activeBlueprint as { title?: string } | null)?.title ?? "Blueprint";

  const donutSegments = useMemo(() => {
    let done = 0;
    let prog = 0;
    let pending = 0;
    phases.forEach((ph) =>
      ph.projects.forEach((p) => {
        const st = projectStatus(p);
        if (st === "completed") done += 1;
        else if (st === "in_progress") prog += 1;
        else pending += 1;
      }),
    );
    const t = done + prog + pending || 1;
    return {
      completed: Math.round((done / t) * 100),
      inProgress: Math.round((prog / t) * 100),
      notStarted: Math.round((pending / t) * 100),
    };
  }, [phases]);

  if (!blueprintId) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <p className="text-gray-700 font-medium">No active blueprint</p>
        <Link href="/validate">
          <span className="inline-block bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">
            Start validation
          </span>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse max-w-7xl mx-auto">
        <div className="h-10 bg-gray-100 rounded-lg w-1/2" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !cc) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-red-600 text-sm">Could not load blueprint.</p>
        <button type="button" onClick={() => void refetch()} className="text-emerald-600 underline text-sm">
          Retry
        </button>
      </div>
    );
  }

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 bg-[#f9fafb] min-h-full">
      <PageHeader
        title="Blueprint Overview"
        subtitle="Your execution plan. Structured. Prioritized. Progressive."
        actions={
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" defaultValue={blueprintTitle}>
            <option>{blueprintTitle}</option>
          </select>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall Progress" value={`${overallPct}%`} sub={<ProgressBar value={overallPct} />} accentClass="text-emerald-600" />
        <StatCard
          label="Current Phase"
          value={activePhase?.name ?? "—"}
          sub={`Phase ${activeIdx + 1} of ${phases.length || 4}`}
          accentClass="text-gray-900"
        />
        <StatCard label="Projects Completed" value={`${completedProjects} / ${totalProjects || "—"}`} accentClass="text-gray-900" />
        <StatCard label="Next Milestone" value="Upcoming" sub="From active phase" accentClass="text-purple-600" icon={<Star className="w-5 h-5 text-purple-500" />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Execution Blueprint</h2>
            <button
              type="button"
              className="text-sm text-emerald-600 font-medium"
              onClick={() => {
                const all: Record<string, boolean> = {};
                phases.forEach((p) => {
                  all[p.id] = true;
                });
                setExpanded(all);
              }}
            >
              Expand all
            </button>
          </div>
          <div className="space-y-4">
            {phases.map((phase, idx) => {
              const state = phaseState(phase, idx, activeIdx);
              const isOpen = expanded[phase.id] ?? state === "active";
              const done = phase.projects.filter((p) => projectStatus(p) === "completed").length;
              const total = phase.projects.length;
              return (
                <div
                  key={phase.id}
                  className={`rounded-xl border p-4 ${
                    state === "locked" ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full flex items-start gap-3 text-left"
                    onClick={() => state !== "locked" && toggle(phase.id)}
                    disabled={state === "locked"}
                  >
                    <div className="mt-0.5">
                      {state === "completed" ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : state === "active" ? (
                        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      ) : (
                        <Lock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          Phase {idx + 1}: {phase.name}
                        </h3>
                        {state === "active" && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            Active
                          </span>
                        )}
                        {state === "locked" && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Locked
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{phase.strategicPurpose}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {done} / {total} Projects
                      </p>
                      <ProgressBar value={total ? (done / total) * 100 : phase.progressionPctOrders} className="mt-2" />
                    </div>
                    {state !== "locked" && (isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />)}
                  </button>
                  {isOpen && state !== "locked" && phase.projects.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="pb-2 pr-4">Project</th>
                            <th className="pb-2 pr-4">Status</th>
                            <th className="pb-2 pr-4">Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phase.projects.map((proj) => {
                            const pst = projectStatus(proj);
                            const pct =
                              pst === "completed" ? 100 : pst === "in_progress" ? Math.round(proj.progressionPctOrders ?? 45) : 0;
                            return (
                              <tr key={proj.id} className="border-t border-gray-100">
                                <td className="py-3 pr-4 font-medium text-gray-900">{proj.name}</td>
                                <td className="py-3 pr-4">
                                  <span
                                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                      pst === "completed"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : pst === "in_progress"
                                          ? "bg-blue-50 text-blue-700"
                                          : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {pst === "completed" ? "Completed" : pst === "in_progress" ? "In Progress" : "Not Started"}
                                  </span>
                                </td>
                                <td className="py-3 pr-4 w-40">
                                  <ProgressBar
                                    value={pct}
                                    className={pst === "in_progress" ? "bg-blue-500" : "bg-emerald-500"}
                                  />
                                  <span className="text-xs text-gray-500">{pct}%</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
            <div className="flex items-center gap-2 justify-center mb-4">
              <h3 className="font-bold text-gray-900">Blueprint Summary</h3>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <DonutProgress value={overallPct} />
            <ul className="mt-4 space-y-2 text-sm text-left">
              <li className="flex justify-between">
                <span className="text-emerald-600">● Completed</span>
                <span>{donutSegments.completed}%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-blue-600">● In Progress</span>
                <span>{donutSegments.inProgress}%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-500">● Not Started</span>
                <span>{donutSegments.notStarted}%</span>
              </li>
            </ul>
            <p className="text-xs text-gray-500 mt-4">{totalProjects} Total Projects</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
            <p className="text-xs font-bold uppercase text-emerald-800">You are on track</p>
            <p className="text-sm text-emerald-900 mt-2">
              Your progress is aligned with your plan. Keep executing with discipline.
            </p>
            <button
              type="button"
              onClick={() => setLocation("/signals")}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              View Signals →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
