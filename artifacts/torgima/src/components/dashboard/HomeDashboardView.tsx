import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/torgima-api";
import { Link, useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Crosshair,
  HeartPulse,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { getDashboardUiState } from "@/lib/dashboard-types";
import type { BlueprintPositionProjection, DashboardProjection } from "@/lib/dashboard-types";
import { getHomePanels, type HomeDashboardPanels } from "@/lib/home-dashboard-types";
import { LaunchNothingnessDashboard } from "@/components/dashboard/LaunchNothingnessDashboard";
import { BlueprintPositionPanel } from "@/components/dashboard/BlueprintPositionPanel";
import { ProjectNameHeader } from "@/components/dashboard/ProjectNameHeader";
import { getConditionLabel, LANGUAGE } from "@/lib/language";

const PURPLE = "#5B21FF";
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[20px] border border-[#E8ECF0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">{children}</p>
  );
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    Critical: "bg-red-50 text-red-700 border-red-100",
    High: "bg-orange-50 text-orange-700 border-orange-100",
    Medium: "bg-amber-50 text-amber-800 border-amber-100",
    Low: "bg-gray-50 text-gray-600 border-gray-100",
  };
  return map[priority] ?? map.Medium;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HomeDashboardView({ state }: { state: DashboardProjection }) {
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();
  const uiState = getDashboardUiState(state);
  const panels = getHomePanels(state);
  const [ordersExpanded, setOrdersExpanded] = useState(false);

  const displayName = me?.displayName ?? state.user?.displayName ?? state.user?.email?.split("@")[0] ?? "Builder";
  const [characterLevel, setCharacterLevel] = useState<number | null>(null);

  useEffect(() => {
    void apiGet<{ character?: { characterLevel?: number } }>("/api/character/current")
      .then((r) => setCharacterLevel(r.character?.characterLevel ?? null))
      .catch(() => setCharacterLevel(null));
  }, []);

  const level = characterLevel ?? 7;

  const dateLabel = useMemo(() => {
    const d = new Date();
    return {
      full: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    };
  }, []);

  if (uiState === "NO_BLUEPRINT") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <Target className="w-12 h-12 mb-4" style={{ color: PURPLE }} />
        <h2 className="text-xl font-bold text-gray-900">{LANGUAGE.dashboard.startProject}</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md">{LANGUAGE.dashboard.noProject}</p>
        <button
          type="button"
          onClick={() => setLocation("/validate")}
          className="mt-6 px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${PURPLE}, #6D28D9)` }}
        >
          Get Started →
        </button>
      </div>
    );
  }

  if (!panels) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Loading execution panels…
      </div>
    );
  }

  const showLaunchNothingness =
    (state.launchFirstLoad?.totalOrders ?? 0) > 0 ||
    (state.launchFirstLoad?.orders?.length ?? 0) > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto pb-24 lg:pb-8">
      {showLaunchNothingness && state.launchFirstLoad ? (
        <LaunchNothingnessDashboard launch={state.launchFirstLoad} />
      ) : (
        <HomeDashboardContent
          panels={panels}
          displayName={displayName}
          level={level}
          dateLabel={dateLabel}
          ordersExpanded={ordersExpanded}
          setOrdersExpanded={setOrdersExpanded}
          alertCount={state.alerts?.length ?? 0}
          blueprintPosition={state.blueprintPosition ?? null}
          activeBlueprint={state.activeBlueprint}
          simplifiedSignalLabel={state.simplifiedSignalLabel}
          signalMode={state.signalMode ?? panels.signalMode}
        />
      )}
    </div>
  );
}

function HomeDashboardContent({
  panels: p,
  displayName,
  level,
  dateLabel,
  ordersExpanded,
  setOrdersExpanded,
  alertCount,
  blueprintPosition,
  activeBlueprint,
  simplifiedSignalLabel,
  signalMode,
}: {
  panels: HomeDashboardPanels;
  displayName: string;
  level: number;
  dateLabel: { full: string; weekday: string };
  ordersExpanded: boolean;
  setOrdersExpanded: (v: boolean) => void;
  alertCount: number;
  blueprintPosition: BlueprintPositionProjection | null;
  activeBlueprint?: DashboardProjection["activeBlueprint"];
  simplifiedSignalLabel?: string | null;
  signalMode?: string | null;
}) {
  const useSimplifiedSignal = signalMode === "simplified" || Boolean(simplifiedSignalLabel);
  const conditionDisplay = getConditionLabel(p.condition.condition);
  const visibleOrders = ordersExpanded ? p.todayOrders : p.todayOrders.slice(0, 4);
  const eh = p.executionHealth;
  const accentOrange = eh.accent === "orange";
  const tierBadge =
    p.blueprintTier ??
    (activeBlueprint as { blueprintTier?: string | null } | undefined)?.blueprintTier ??
    null;
  const signalLine =
    useSimplifiedSignal && (eh.signalName || simplifiedSignalLabel)
      ? `Signal: ${eh.signalName ?? simplifiedSignalLabel}`
      : eh.signalName
        ? `Signal window: ${eh.signalName}`
        : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 pb-24 lg:pb-8">
      <ProjectNameHeader
        blueprintId={activeBlueprint?.id}
        projectName={
          (activeBlueprint as { projectName?: string | null } | undefined)?.projectName ??
          activeBlueprint?.title
        }
        goal={activeBlueprint?.rawGoal ?? activeBlueprint?.title}
        tierBadge={tierBadge}
      />
      {blueprintPosition ? <BlueprintPositionPanel position={blueprintPosition} /> : null}
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#0F172A]">
            {LANGUAGE.dashboard.welcome}, {displayName} 👋
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Execute with clarity. Adapt with precision. Win in reality.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Card className="px-4 py-2.5 flex items-center gap-2 !rounded-2xl">
            <Calendar className="w-4 h-4 text-[#64748B]" />
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">{dateLabel.full}</p>
              <p className="text-[10px] text-[#64748B]">{dateLabel.weekday}</p>
            </div>
          </Card>
          <Link href="/signals">
            <button type="button" className="relative p-2.5 rounded-2xl border border-[#E8ECF0] bg-white hover:bg-gray-50">
              <Bell className="w-5 h-5 text-[#64748B]" />
              {alertCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: PURPLE }}
                >
                  {alertCount}
                </span>
              )}
            </button>
          </Link>
          <Link href="/settings">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#E8ECF0] bg-white cursor-pointer hover:bg-gray-50">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: PURPLE }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-[#0F172A]">{displayName}</p>
                <p className="text-[10px] text-[#64748B]">Level {level}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-[#94A3B8] hidden sm:block" />
            </div>
          </Link>
        </div>
      </header>

      {/* Row 1 — mobile priority order */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Execution Health */}
        <Card className="lg:col-span-4 p-5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${accentOrange ? "bg-orange-50" : "bg-violet-50"}`}
            >
              <HeartPulse className={`w-5 h-5 ${accentOrange ? "text-orange-500" : "text-violet-600"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <SectionLabel>Execution Health</SectionLabel>
              <p className={`text-lg font-bold mt-1 ${accentOrange ? "text-orange-600" : "text-violet-700"}`}>
                {eh.mode}
                {eh.driftLabel ? ` ${eh.driftLabel}` : ""}
              </p>
              <p className="text-sm text-[#64748B] mt-2 leading-relaxed">{eh.summary}</p>
              {signalLine ? (
                <p className="text-xs font-semibold text-[#5B21FF] mt-2">{signalLine}</p>
              ) : null}
              {eh.reasoning.slice(0, 2).map((line, i) => (
                <p key={i} className="text-xs text-[#64748B] mt-1">
                  {line}
                </p>
              ))}
              <Link href={eh.blueprintHref}>
                <span
                  className="inline-flex mt-4 items-center gap-1 text-sm font-semibold border rounded-xl px-4 py-2 cursor-pointer hover:bg-violet-50"
                  style={{ color: PURPLE, borderColor: `${PURPLE}40` }}
                >
                  {LANGUAGE.dashboard.viewProject}
                </span>
              </Link>
            </div>
          </div>
        </Card>

        {/* Today */}
        <Card className="lg:col-span-4 p-5">
          <SectionLabel>Today</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-center sm:text-left">
            <div>
              <p className="text-xl font-bold text-[#0F172A]">{p.today.executing}</p>
              <p className="text-[10px] text-[#64748B] font-medium">Executing</p>
            </div>
            <div>
              <p className="text-xl font-bold text-[#0F172A]">+{p.today.queued}</p>
              <p className="text-[10px] text-[#64748B] font-medium">Queued</p>
            </div>
            <div>
              <p className="text-xl font-bold text-orange-600">{p.today.atRisk}</p>
              <p className="text-[10px] text-[#64748B] font-medium">At Risk</p>
            </div>
            <div>
              <p className="text-xl font-bold text-[#0F172A]">{p.today.capacityLabel}</p>
              <p className="text-[10px] text-[#64748B] font-medium">Capacity</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#64748B]">Execution Load</span>
              <span className="font-bold" style={{ color: PURPLE }}>
                {p.today.loadPercent}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#EEF2FF] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${p.today.loadPercent}%`, backgroundColor: PURPLE }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            {p.today.conditionImpact && (
              <span className="flex items-center gap-1.5 text-xs text-orange-600">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                {p.today.conditionImpact}
              </span>
            )}
            <Link href={p.today.ordersHref}>
              <span className="text-xs font-semibold ml-auto" style={{ color: PURPLE }}>
                View today →
              </span>
            </Link>
          </div>
        </Card>

        {/* Condition + Drivers */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>{LANGUAGE.condition.title}</SectionLabel>
              {p.condition.urgency && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                  {getConditionLabel("urgency").label}
                </span>
              )}
            </div>
            <p className="mt-2 text-lg font-bold text-[#0F172A]">
              {conditionDisplay.emoji} {conditionDisplay.label}
            </p>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              {p.condition.conditionExplanation ?? conditionDisplay.description}
            </p>
            <p className="text-xs font-semibold text-[#5B21FF] mt-2">Next: {conditionDisplay.nextStep}</p>
            <div className="flex gap-4 mt-3">
              <Crosshair className="w-10 h-10 text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold text-[#0F172A] mb-1">Allowed</p>
                {p.condition.allowed.map((a) => (
                  <p key={a} className="flex items-center gap-1 text-[#64748B]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {a}
                  </p>
                ))}
                <p className="font-semibold text-[#0F172A] mt-2 mb-1">Restricted</p>
                {p.condition.restricted.length === 0 ? (
                  <p className="text-[#94A3B8]">None</p>
                ) : (
                  p.condition.restricted.map((r) => (
                    <p key={r} className="flex items-center gap-1 text-[#64748B]">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {r}
                    </p>
                  ))
                )}
              </div>
            </div>
            <p className="text-right text-lg font-bold text-emerald-600 mt-2">
              {p.condition.confidencePercent}%
            </p>
            <p className="text-[10px] text-right text-[#64748B]">Confidence</p>
          </Card>

          <Card className="p-4">
            <SectionLabel>Top Drivers</SectionLabel>
            <ul className="mt-2 space-y-2">
              {p.topDrivers.length === 0 ? (
                <li className="text-xs text-[#94A3B8]">No driver signals in current window.</li>
              ) : (
                p.topDrivers.map((d, i) => (
                  <li key={i} className="text-xs">
                    <div className="flex items-start gap-1">
                      {d.direction === "up" ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <span>
                        <span className={d.direction === "up" ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                          {d.impactPercent > 0 ? "+" : ""}
                          {d.impactPercent}%
                        </span>{" "}
                        {d.name}
                        <span className="text-[#94A3B8] block">({d.driverType})</span>
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <Link href="/signals">
              <span className="text-xs font-semibold mt-2 inline-block" style={{ color: PURPLE }}>
                View all signals →
              </span>
            </Link>
          </Card>
        </div>
      </div>

      {/* Row 2 — Orders + Timeline + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-7 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <SectionLabel>Today&apos;s Orders</SectionLabel>
              <p className="text-xs text-[#64748B] mt-0.5">
                Top priority tasks based on your progress and impact.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B]">
                {visibleOrders.length} of {p.todayOrdersTotal} shown
              </span>
              <button
                type="button"
                onClick={() => setOrdersExpanded(!ordersExpanded)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E8ECF0] flex items-center gap-1"
              >
                {ordersExpanded ? "Collapse" : "Expand"}
                <ChevronDown className={`w-3 h-3 transition ${ordersExpanded ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
          <ul className="divide-y divide-[#F1F5F9]">
            {visibleOrders.length === 0 ? (
              <li className="py-8 text-center text-sm text-[#64748B]">No active orders for today.</li>
            ) : (
              visibleOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3 group">
                  <span className="w-6 text-xs font-bold text-[#94A3B8]">{o.rank}</span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/tasks/${o.id}`}>
                      <p className="text-sm font-semibold text-[#0F172A] truncate hover:text-violet-700 cursor-pointer">
                        {o.title}
                      </p>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {o.projectName && (
                        <span className="text-[10px] text-[#64748B]">{o.projectName}</span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 capitalize">
                        {o.orderType}
                      </span>
                      {o.estimatedMinutes != null && (
                        <span className="text-[10px] text-[#94A3B8]">{o.estimatedMinutes}m</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge(o.priority)}`}
                  >
                    {o.priority}
                  </span>
                </li>
              ))
            )}
          </ul>
          {!ordersExpanded && p.todayOrdersTotal > visibleOrders.length && (
            <button
              type="button"
              onClick={() => setOrdersExpanded(true)}
              className="mt-3 text-sm font-semibold"
              style={{ color: PURPLE }}
            >
              +{p.todayOrdersTotal - visibleOrders.length} More Orders
            </button>
          )}
        </Card>

        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <Card className="p-4">
            <SectionLabel>Timeline Integrity</SectionLabel>
            {[
              { label: "Planned", pct: p.timelineIntegrity.plannedPercent, color: PURPLE },
              { label: "Actual", pct: p.timelineIntegrity.actualPercent, color: "#F97316" },
            ].map((bar) => (
              <div key={bar.label} className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#64748B]">{bar.label}</span>
                  <span className="font-semibold">{bar.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${bar.pct}%`, backgroundColor: bar.color }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#64748B]">Drift</span>
                <span className="font-semibold text-red-600">
                  {p.timelineIntegrity.driftLabel ?? (p.timelineIntegrity.ahead ? "Ahead" : "On track")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{
                    width: `${Math.min(100, (p.timelineIntegrity.driftDays ?? 0) * 3)}%`,
                  }}
                />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex justify-between items-center">
              <SectionLabel>Milestones</SectionLabel>
              <Link href={p.planOverview.href}>
                <span className="text-[10px] font-semibold" style={{ color: PURPLE }}>
                  View all
                </span>
              </Link>
            </div>
            <ul className="mt-3 space-y-3">
              {p.milestones.length === 0 ? (
                <li className="text-xs text-[#94A3B8]">No phase milestones yet.</li>
              ) : (
                p.milestones.slice(0, 3).map((m) => (
                  <li key={m.id} className="text-xs border-b border-[#F1F5F9] pb-2 last:border-0">
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold text-[#0F172A] truncate">{m.name}</p>
                      {(m.status === "Overdue" || m.status === "Delayed") && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-600 shrink-0">
                          {m.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[#94A3B8] mt-0.5">
                      {m.expectedDate ? `Expected ${m.expectedDate}` : "No due date"}
                      {m.varianceDays != null ? ` · +${m.varianceDays} days` : ""}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <SectionLabel>Plan Overview</SectionLabel>
          <p className="text-sm text-[#64748B] mt-1">
            You&apos;re in Plan {p.planOverview.currentPlanIndex} of {p.planOverview.totalPlans}
          </p>
          <div className="flex items-center gap-4 mt-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-lg font-bold border-4"
              style={{ borderColor: PURPLE, color: PURPLE }}
            >
              {p.planOverview.completionPercent}%
            </div>
            <ul className="flex-1 space-y-1 text-xs">
              {p.planOverview.plans.map((plan) => (
                <li
                  key={plan.index}
                  className={
                    plan.status === "Active"
                      ? "font-bold text-violet-700"
                      : plan.status === "Locked"
                        ? "text-[#94A3B8]"
                        : "text-[#64748B]"
                  }
                >
                  Plan {plan.index}: {plan.status}
                </li>
              ))}
            </ul>
          </div>
          <Link href={p.planOverview.href}>
            <span className="text-xs font-semibold mt-3 inline-block" style={{ color: PURPLE }}>
              View all plans →
            </span>
          </Link>
        </Card>

        <Card className="p-5">
          <SectionLabel>Phase Progress</SectionLabel>
          <p className="text-sm text-[#64748B] mt-1">
            Current: Phase {p.phaseProgress.currentPhaseIndex} of {p.phaseProgress.totalPhases}
          </p>
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
            {p.phaseProgress.phases.map((ph) => (
              <div key={ph.index} className="flex flex-col items-center min-w-[72px]">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    ph.status === "Current"
                      ? "text-white"
                      : ph.status === "Completed"
                        ? "bg-violet-100 text-violet-700"
                        : "bg-gray-100 text-gray-400"
                  }`}
                  style={ph.status === "Current" ? { backgroundColor: PURPLE } : undefined}
                >
                  {ph.index}
                </div>
                <p className="text-[9px] text-center mt-1 text-[#64748B] max-w-[80px] leading-tight">
                  {ph.label ?? ph.name}
                </p>
              </div>
            ))}
          </div>
          <Link href={p.phaseProgress.href}>
            <span className="text-xs font-semibold mt-3 inline-block" style={{ color: PURPLE }}>
              View all phases →
            </span>
          </Link>
        </Card>

        <Card className="p-5">
          <div className="flex justify-between">
            <SectionLabel>Recent Activity</SectionLabel>
            <Link href="/reports">
              <span className="text-[10px] font-semibold" style={{ color: PURPLE }}>
                View all
              </span>
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {p.recentActivity.length === 0 ? (
              <li className="text-xs text-[#94A3B8]">No recent system events.</li>
            ) : (
              p.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-xs">
                  <ActivityIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    {a.href ? (
                      <Link href={a.href}>
                        <p className="text-[#0F172A] hover:text-violet-700 truncate cursor-pointer">{a.message}</p>
                      </Link>
                    ) : (
                      <p className="text-[#0F172A] truncate">{a.message}</p>
                    )}
                    <p className="text-[#94A3B8]">{formatRelativeTime(a.at)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      {/* Bhudhi insight strip */}
      {p.bhudhiInsight && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-violet-100 bg-gradient-to-r from-violet-50/80 to-white">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 shrink-0" style={{ color: PURPLE }} />
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{p.bhudhiInsight.headline}</p>
              {p.bhudhiInsight.body && (
                <p className="text-xs text-[#64748B] mt-0.5 max-w-2xl">{p.bhudhiInsight.body}</p>
              )}
              {p.bhudhiInsight.nextAction && (
                <p className="text-xs font-medium mt-1" style={{ color: PURPLE }}>
                  Next: {p.bhudhiInsight.nextAction}
                </p>
              )}
            </div>
          </div>
          <Link href="/app/bhudhi">
            <span
              className="text-xs font-bold px-4 py-2 rounded-xl text-white"
              style={{ backgroundColor: PURPLE }}
            >
              Open Bhudhi
            </span>
          </Link>
        </Card>
      )}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 shrink-0 mt-0.5";
  switch (type) {
    case "feedback":
      return <ClipboardList className={`${cls} text-emerald-500`} />;
    case "bhudhi":
      return <Sparkles className={`${cls} text-violet-600`} />;
    case "condition":
      return <AlertTriangle className={`${cls} text-orange-500`} />;
    default:
      return <TrendingUp className={`${cls} text-blue-500`} />;
  }
}

/** @deprecated Use HomeDashboardView — kept for imports */
export function MainDashboardView({ state }: { state: DashboardProjection }) {
  return <HomeDashboardView state={state} />;
}
