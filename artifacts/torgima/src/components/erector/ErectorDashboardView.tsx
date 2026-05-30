import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bell,
  Box,
  Calendar,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Hexagon,
  Lightbulb,
  Target,
  TrendingUp,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { fetchErectorDashboard } from "@/lib/erector-dashboard-api";
import type { ErectorDashboardPanels } from "@/lib/erector-dashboard-types";
import { apiGet } from "@/lib/torgima-api";

const PURPLE = "#5B21FF";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[18px] border border-[#E8ECF0] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

function verdictStyles(label: string) {
  if (label === "Proceed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (label === "Pivot") return "bg-red-50 text-red-700 border-red-100";
  if (label === "Blocked") return "bg-gray-100 text-gray-600 border-gray-200";
  return "bg-orange-50 text-orange-700 border-orange-100";
}

const ACTION_CARDS = [
  {
    key: "validate",
    title: "Validate New Idea",
    icon: Target,
    accent: "#22C55E",
    accentBg: "#F0FDF4",
    border: "#BBF7D0",
    description: "Test your idea against reality before you build.",
    points: [
      "Market reality check",
      "Demand & competition",
      "Risk & opportunity scan",
      "Direction recommendation",
    ],
    cta: "Start New Validation",
    href: "/validate",
  },
  {
    key: "simulator",
    title: "Project Simulator",
    icon: Box,
    accent: PURPLE,
    accentBg: "#F5F3FF",
    border: "#DDD6FE",
    description: "Simulate outcomes, paths, and scenarios before you commit.",
    points: [
      "Simulate current project",
      "Simulate future project",
      "Test alternative strategies",
      "See impact of condition changes",
    ],
    cta: "Open Simulator",
    hrefKey: "simulatorHref" as const,
    fallbackHref: "/validate",
  },
  {
    key: "academy",
    title: "Academy & Skills",
    icon: GraduationCap,
    accent: "#F97316",
    accentBg: "#FFF7ED",
    border: "#FED7AA",
    description: "Build skills. Track progress. Grow your execution ability.",
    points: [
      "Browse skills or courses",
      "Track learning progress",
      "Continue where you left off",
      "Get recommended learning",
    ],
    cta: "Go to Academy",
    href: "/academy",
  },
  {
    key: "industry",
    title: "Industry Trends",
    icon: TrendingUp,
    accent: "#3B82F6",
    accentBg: "#EFF6FF",
    border: "#BFDBFE",
    description: "Stay aware of changes, shifts, and new opportunities.",
    points: [
      "Market trends & shifts",
      "Competitor movement",
      "Emerging opportunities",
      "Timing & risk alerts",
    ],
    cta: "View Industry Intelligence",
    hrefKey: "industryHref" as const,
    fallbackHref: "/validate",
  },
] as const;

export function ErectorDashboardView() {
  const { data: me } = useGetMe();
  const [panels, setPanels] = useState<ErectorDashboardPanels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(7);

  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Builder";

  const load = useCallback(async () => {
    try {
      setError(null);
      setPanels(await fetchErectorDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Erector dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    void apiGet<{ character?: { characterLevel?: number } }>("/api/character/current")
      .then((r) => setLevel(r.character?.characterLevel ?? 7))
      .catch(() => setLevel(7));
  }, []);

  const dateLabel = useMemo(() => {
    const d = new Date();
    return {
      full: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    };
  }, []);

  if (loading && !panels) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-[#64748B]">
        Loading Erector dashboard…
      </div>
    );
  }

  if (error && !panels) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 text-sm font-semibold" style={{ color: PURPLE }}>
          Retry
        </button>
      </div>
    );
  }

  if (!panels) return null;

  const snap = panels.industrySnapshot;

  return (
    <div className="min-h-full bg-[#FAFAFA] pb-10">
      <header className="bg-white border-b border-[#E8ECF0] px-4 sm:px-8 py-5">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#F5F3FF" }}
            >
              <Hexagon className="w-5 h-5" style={{ color: PURPLE }} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Erector Dashboard</h1>
              <p className="text-sm text-[#64748B] mt-0.5">
                Validate ideas. Simulate paths. Prepare for execution.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Card className="!rounded-2xl px-4 py-2 flex items-center gap-2 !shadow-none">
              <Calendar className="w-4 h-4 text-[#64748B]" />
              <div>
                <p className="text-xs font-semibold">{dateLabel.full}</p>
                <p className="text-[10px] text-[#64748B]">{dateLabel.weekday}</p>
              </div>
            </Card>
            <button type="button" className="p-2.5 rounded-2xl border border-[#E8ECF0] bg-white relative">
              <Bell className="w-5 h-5 text-[#64748B]" />
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#E8ECF0] bg-white">
              <div
                className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ backgroundColor: PURPLE }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold">{displayName}</p>
                <p className="text-[10px] text-[#64748B]">Level {level}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {ACTION_CARDS.map((card) => {
            const Icon = card.icon;
            const href =
              "hrefKey" in card && card.hrefKey
                ? panels.links[card.hrefKey] ?? card.fallbackHref
                : card.href;
            return (
              <Card key={card.key} className="p-5 flex flex-col">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: card.accentBg, color: card.accent }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">{card.title}</h3>
                <p className="text-xs text-[#64748B] mt-1 flex-1 leading-relaxed">{card.description}</p>
                <ul className="mt-3 space-y-1">
                  {card.points.map((p) => (
                    <li key={p} className="text-[10px] text-[#64748B] flex items-center gap-1.5">
                      <span style={{ color: card.accent }}>✔</span> {p}
                    </li>
                  ))}
                </ul>
                <Link href={href}>
                  <span
                    className="mt-4 block w-full text-center text-xs font-bold py-2.5 rounded-xl text-white"
                    style={{ backgroundColor: card.accent }}
                  >
                    {card.cta}
                  </span>
                </Link>
              </Card>
            );
          })}
        </div>

        {/* Validations + Simulations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-[#0F172A]">Recent Validations</h2>
              <Link href="/validation/scores">
                <span className="text-xs font-semibold" style={{ color: PURPLE }}>
                  View all
                </span>
              </Link>
            </div>
            <ul className="divide-y divide-[#F1F5F9]">
              {panels.recentValidations.length === 0 ? (
                <li className="py-8 text-center text-xs text-[#94A3B8]">
                  No completed validations yet.{" "}
                  <Link href="/validate" className="font-semibold" style={{ color: PURPLE }}>
                    Start your first →
                  </Link>
                </li>
              ) : (
                panels.recentValidations.map((v) => (
                  <li key={v.id}>
                    <Link href={v.href}>
                      <div className="flex items-center gap-3 py-3 group cursor-pointer hover:bg-gray-50/80 -mx-2 px-2 rounded-lg">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "#F5F3FF" }}
                        >
                          <Target className="w-4 h-4" style={{ color: PURPLE }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0F172A] truncate">{v.name}</p>
                          <p className="text-[10px] text-[#94A3B8] truncate">{v.description}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${verdictStyles(v.verdictLabel)}`}
                            >
                              {v.verdictLabel}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">{v.date}</span>
                            <span className="text-[10px] font-semibold text-[#0F172A]">
                              {v.realityScorePercent}% Reality
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-violet-500" />
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-[#0F172A]">Simulation Scenarios</h2>
              {panels.links.simulatorHref && (
                <Link href={panels.links.simulatorHref}>
                  <span className="text-xs font-semibold" style={{ color: PURPLE }}>
                    View all
                  </span>
                </Link>
              )}
            </div>
            <ul className="divide-y divide-[#F1F5F9]">
              {panels.simulationScenarios.length === 0 ? (
                <li className="py-8 text-center text-xs text-[#94A3B8]">
                  {panels.activeBlueprintId
                    ? "Run a simulation from the Project Simulator to see scenarios here."
                    : "Activate a blueprint to unlock scenario history."}
                </li>
              ) : (
                panels.simulationScenarios.map((s) => (
                  <li key={s.id}>
                    {s.href ? (
                      <Link href={s.href}>
                        <ScenarioRow s={s} />
                      </Link>
                    ) : (
                      <ScenarioRow s={s} />
                    )}
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>

        {/* Industry + Learning */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-7 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-[#0F172A]">Current Industry Snapshot</h2>
              {snap.href && (
                <Link href={snap.href}>
                  <span className="text-xs font-semibold" style={{ color: PURPLE }}>
                    View full report
                  </span>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MiniStat label="Market Momentum" value={snap.marketMomentum.status} sub={snap.marketMomentum.changeLabel} color="#22C55E" />
              <MiniStat label="Competition" value={snap.competitionLevel.status} sub={snap.competitionLevel.subtext} color="#EAB308" />
              <MiniStat label="Opportunity" value={snap.opportunityWindow.status} sub={snap.opportunityWindow.subtext} bar={snap.opportunityWindow.percent} color={PURPLE} />
              <MiniStat label="Risk Level" value={snap.riskLevel.status} sub={snap.riskLevel.subtext} color="#F97316" />
              <MiniStat label="Top Opportunity" value={snap.topOpportunity.title} sub={snap.topOpportunity.description} color="#3B82F6" small />
            </div>
            {snap.insight && (
              <div className="mt-4 rounded-xl bg-violet-50 border border-violet-100 p-3 flex gap-2">
                <Lightbulb className="w-4 h-4 shrink-0" style={{ color: PURPLE }} />
                <p className="text-xs text-[#64748B] leading-relaxed flex-1">{snap.insight}</p>
                {snap.href && (
                  <Link href={snap.href}>
                    <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: PURPLE }}>
                      See Opportunities →
                    </span>
                  </Link>
                )}
              </div>
            )}
          </Card>

          <Card className="lg:col-span-5 p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-[#0F172A]">Learning Progress</h2>
              <Link href="/academy">
                <span className="text-xs font-semibold" style={{ color: PURPLE }}>
                  Go to Academy
                </span>
              </Link>
            </div>
            <ul className="flex-1 space-y-3">
              {panels.learningProgress.length === 0 ? (
                <li className="text-xs text-[#94A3B8] py-6 text-center">No active courses — explore the Academy catalog.</li>
              ) : (
                panels.learningProgress.map((c) => (
                  <li key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-[#0F172A] truncate pr-2">{c.courseName}</span>
                      <span className="text-[#64748B] shrink-0">{c.progressPercent}%</span>
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mb-1">{c.courseType}</p>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${c.progressPercent}%` }}
                      />
                    </div>
                    <Link href={c.href}>
                      <span className="text-[10px] font-semibold mt-1 inline-block" style={{ color: PURPLE }}>
                        {c.action} →
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
            <Link href="/academy">
              <span className="block text-center text-xs font-semibold text-[#64748B] mt-4 hover:text-violet-700">
                Browse All Skills & Courses
              </span>
            </Link>
          </Card>
        </div>

        {/* Footer banner */}
        <Card className="p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-violet-50 to-white border-violet-100">
          <div>
            <p className="text-sm font-bold text-[#0F172A]">
              Erector prepares your execution before you build.
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Validate with truth. Simulate with clarity. Build with confidence.
            </p>
          </div>
          <Link href="/validate">
            <span
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${PURPLE}, #6D28D9)` }}
            >
              Start Something New
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </Card>
      </div>
    </div>
  );
}

function ScenarioRow({ s }: { s: ErectorDashboardPanels["simulationScenarios"][0] }) {
  return (
    <div className="flex items-start gap-3 py-3 group hover:bg-gray-50/80 -mx-2 px-2 rounded-lg">
      <Box className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#0F172A] leading-snug">{s.question}</p>
        {s.projectName && <p className="text-[10px] text-[#94A3B8] mt-0.5">{s.projectName}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className={`text-[10px] font-bold ${s.impactPercent >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {s.impactLabel}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            {s.condition}
          </span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  color,
  bar,
  small,
}: {
  label: string;
  value: string;
  sub: string | null;
  color: string;
  bar?: number;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#F1F5F9] bg-[#FAFAFA] p-3">
      <p className="text-[9px] font-bold uppercase text-[#94A3B8]">{label}</p>
      <p className={`font-bold text-[#0F172A] mt-1 ${small ? "text-xs leading-tight" : "text-sm"}`}>{value}</p>
      {bar != null && (
        <div className="h-1 rounded-full bg-gray-200 mt-2 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${bar}%`, backgroundColor: color }} />
        </div>
      )}
      {sub && <p className="text-[9px] text-[#94A3B8] mt-1 line-clamp-2">{sub}</p>}
    </div>
  );
}
