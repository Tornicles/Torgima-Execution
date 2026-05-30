import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bell,
  Brain,
  Calendar,
  ChevronDown,
  ChevronRight,
  Compass,
  Lightbulb,
  ListTodo,
  Shield,
  Sparkles,
  Target,
  User,
  Zap,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { explainBhudhiQuestion, fetchBhudhiHub } from "@/lib/bhudhi-hub-api";
import type { BhudhiExplainResponse, BhudhiHubPanels, BhudhiQuestionCategory } from "@/lib/bhudhi-hub-types";
import { BhudhiExplainDrawer } from "@/components/bhudhi/BhudhiExplainDrawer";
import { apiGet } from "@/lib/torgima-api";

const PURPLE = "#5B21FF";
const PURPLE_LIGHT = "#F5F3FF";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[18px] border border-[#E8ECF0] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CATEGORY_ICONS: Record<BhudhiQuestionCategory, typeof ListTodo> = {
  tasks: ListTodo,
  execution: Zap,
  strategy: Compass,
  self: User,
};

const INTELLIGENCE_CARDS = [
  {
    key: "tasks",
    title: "Your Tasks",
    description: "Why tasks exist and what they impact.",
    color: PURPLE,
    bg: PURPLE_LIGHT,
  },
  {
    key: "execution",
    title: "Your Execution",
    description: "Why your condition and signals are the way they are.",
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  {
    key: "strategy",
    title: "Your Direction",
    description: "Validate strategy, check alignment, explore alternatives.",
    color: "#22C55E",
    bg: "#F0FDF4",
  },
  {
    key: "self",
    title: "Yourself",
    description: "Patterns, identity stage, and your growth edge.",
    color: "#F97316",
    bg: "#FFF7ED",
  },
] as const;

function BhudhiBrainSymbol() {
  return (
    <div className="relative w-32 h-32 mx-auto">
      <div className="absolute inset-0 rounded-full border-2 border-violet-200 animate-pulse" />
      <div className="absolute inset-3 rounded-full border border-violet-100" />
      <div className="absolute inset-6 rounded-full bg-violet-50 flex items-center justify-center">
        <Brain className="w-12 h-12 text-violet-600" strokeWidth={1.25} />
      </div>
    </div>
  );
}

export function BhudhiHubView({ blueprintId }: { blueprintId: string }) {
  const { data: me } = useGetMe();
  const [hub, setHub] = useState<BhudhiHubPanels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(7);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainData, setExplainData] = useState<BhudhiExplainResponse | null>(null);

  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Builder";

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchBhudhiHub(blueprintId);
      setHub(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Bhudhi Hub");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    setLoading(true);
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    void apiGet<{ character?: { characterLevel?: number } }>("/api/character/current")
      .then((r) => setLevel(r.character?.characterLevel ?? 7))
      .catch(() => setLevel(7));
  }, []);

  const ask = useCallback(
    async (questionKey: string, glanceKey?: "condition" | "momentum" | "focus" | "goal_progress") => {
      setDrawerOpen(true);
      setExplainLoading(true);
      setExplainData(null);
      try {
        const res = await explainBhudhiQuestion({ blueprintId, questionKey, glanceKey });
        setExplainData(res);
      } catch {
        setExplainData({
          questionKey,
          label: questionKey,
          explanation: {
            title: "Unable to load explanation",
            sections: [
              {
                heading: "Status",
                body: "The explanation service could not reach the server. Retry when connected.",
              },
            ],
            confidence: 0,
          },
          aiEnrichment: null,
          fallbackUsed: true,
          principle: "Bhudhi explains. You decide. You execute.",
        });
      } finally {
        setExplainLoading(false);
      }
    },
    [blueprintId],
  );

  const dateLabel = useMemo(() => {
    const d = new Date();
    return {
      full: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    };
  }, []);

  if (loading && !hub) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-[#64748B]">Loading intelligence layer…</p>
      </div>
    );
  }

  if (error && !hub) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 text-sm font-semibold" style={{ color: PURPLE }}>
          Retry
        </button>
      </div>
    );
  }

  if (!hub) return null;

  return (
    <div className="min-h-full bg-[#FAFAFA] pb-10">
      <BhudhiExplainDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} loading={explainLoading} data={explainData} />

      {/* Header */}
      <header className="bg-white border-b border-[#E8ECF0] px-4 sm:px-8 py-5">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6" style={{ color: PURPLE }} />
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Bhudhi Hub</h1>
            </div>
            <p className="text-sm text-[#64748B] mt-1">
              Understand your system. Make clearer decisions.
            </p>
            <Link href="/app/bhudhi?section=systems">
              <span className="text-xs font-semibold mt-1 inline-block hover:underline" style={{ color: PURPLE }}>
                How Bhudhi works →
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Card className="!rounded-2xl px-4 py-2 flex items-center gap-2 !shadow-none">
              <Calendar className="w-4 h-4 text-[#64748B]" />
              <div>
                <p className="text-xs font-semibold">{dateLabel.full}</p>
                <p className="text-[10px] text-[#64748B]">{dateLabel.weekday}</p>
              </div>
            </Card>
            <Link href="/signals">
              <button type="button" className="p-2.5 rounded-2xl border border-[#E8ECF0] bg-white relative">
                <Bell className="w-5 h-5 text-[#64748B]" />
              </button>
            </Link>
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-[#E8ECF0] bg-white">
              <div className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: PURPLE }}>
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
        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-6 sm:p-8 text-center">
            <BhudhiBrainSymbol />
            <div className="flex items-center justify-center gap-2 mt-4">
              <p className="text-lg font-bold text-[#0F172A]">Bhudhi is active</p>
              {hub.core.online && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Online
                </span>
              )}
            </div>
            <p className="text-sm text-[#64748B] mt-3 max-w-sm mx-auto leading-relaxed">
              I don&apos;t make decisions. I read your system and help you understand what&apos;s happening and why.
            </p>
            <div className="mt-5 mx-auto max-w-xs rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 flex items-center gap-3 text-left">
              <Shield className="w-5 h-5 shrink-0" style={{ color: PURPLE }} />
              <div>
                <p className="text-xs font-semibold text-[#0F172A]">
                  {hub.core.allSystemsConnected ? "All systems connected" : "Systems connecting"}
                </p>
                <p className="text-[10px] text-[#64748B]">Last sync: {hub.core.lastSyncLabel}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="text-sm font-bold text-[#0F172A] mb-4">What can I help you understand today?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTELLIGENCE_CARDS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    const cat = hub.popularQuestions[c.key as BhudhiQuestionCategory];
                    const first = cat?.questions[0];
                    if (first) void ask(first.key);
                  }}
                  className="text-left p-4 rounded-2xl border border-[#E8ECF0] hover:border-violet-200 transition"
                  style={{ backgroundColor: c.bg }}
                >
                  <p className="text-sm font-bold" style={{ color: c.color }}>
                    {c.title}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1 leading-snug">{c.description}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* System explanation row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-5 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">
              Where my information comes from
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {hub.pipeline.map((node, i) => (
                <span key={node.id} className="flex items-center gap-2">
                  <span className="px-3 py-2 rounded-xl border border-[#E8ECF0] bg-[#FAFAFA]">
                    <span className="font-semibold text-[#0F172A] block">{node.name}</span>
                    <span className={`flex items-center gap-1 mt-0.5 ${node.live ? "text-emerald-600" : "text-[#94A3B8]"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${node.live ? "bg-emerald-500" : "bg-gray-300"}`} />
                      {node.live ? "Live" : node.status}
                    </span>
                  </span>
                  {i < hub.pipeline.length - 1 && <ChevronRight className="w-4 h-4 text-[#CBD5E1] hidden sm:block" />}
                </span>
              ))}
            </div>
            <p className="text-xs text-[#64748B] mt-4 leading-relaxed">
              Bhudhi reads these systems in real time and explains what they mean for you.
            </p>
            <Link href="/app/bhudhi?section=systems">
              <span className="text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: PURPLE }}>
                View data map <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </Card>

          <Card className="lg:col-span-3 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Today at a glance</p>
            <ul className="space-y-3">
              {[
                {
                  label: "Condition",
                  value: hub.glance.conditionLabel,
                  btn: "Why this condition?",
                  glance: "condition" as const,
                  key: "why_this_condition",
                },
                {
                  label: "Momentum",
                  value: hub.glance.momentum,
                  btn: "Why this level?",
                  glance: "momentum" as const,
                  key: "why_momentum_level",
                },
                {
                  label: "Today's Focus",
                  value: hub.glance.focus.toUpperCase(),
                  btn: "Why this focus?",
                  glance: "focus" as const,
                  key: "why_this_focus",
                },
                {
                  label: "Main Goal Progress",
                  value: `${hub.glance.goalProgressPercent}%`,
                  btn: "What&apos;s affecting this?",
                  glance: "goal_progress" as const,
                  key: "goal_progress_drivers",
                },
              ].map((row) => (
                <li key={row.label} className="border-b border-[#F1F5F9] pb-2 last:border-0">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">{row.label}</span>
                    <span className="font-bold text-[#0F172A]">{row.value}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void ask(row.key, row.glance)}
                    className="text-[10px] font-semibold mt-1 hover:underline"
                    style={{ color: PURPLE }}
                  >
                    {row.btn.replace("&apos;", "'")} →
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-4 p-5">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                System Activity (What happened)
              </p>
              <Link href="/reports">
                <span className="text-[10px] font-semibold" style={{ color: PURPLE }}>
                  View all
                </span>
              </Link>
            </div>
            <ul className="space-y-3 max-h-[220px] overflow-y-auto">
              {hub.systemActivity.length === 0 ? (
                <li className="text-xs text-[#94A3B8]">No recent automated events recorded.</li>
              ) : (
                hub.systemActivity.map((a) => (
                  <li key={a.id} className="group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] leading-snug">{a.title}</p>
                        <p className="text-[10px] text-[#64748B] mt-0.5 line-clamp-2">{a.reason}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">
                          {a.source} · {formatRelative(a.at)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0 opacity-0 group-hover:opacity-100" />
                    </div>
                  </li>
                ))
              )}
            </ul>
            <p className="text-[10px] text-[#94A3B8] mt-3 border-t border-[#F1F5F9] pt-2">
              These updates come from the system. Bhudhi explains the why.
            </p>
          </Card>
        </div>

        {/* Questions + recent */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-8 p-5">
            <p className="text-sm font-bold text-[#0F172A]">Popular Questions</p>
            <p className="text-xs text-[#64748B] mb-4">(Pick one to understand better)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {(Object.keys(hub.popularQuestions) as BhudhiQuestionCategory[]).map((cat) => {
                const block = hub.popularQuestions[cat];
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon className="w-3.5 h-3.5 text-[#64748B]" />
                      <p className="text-[10px] font-bold uppercase text-[#64748B] leading-tight">{block.title}</p>
                    </div>
                    <ul className="space-y-1.5">
                      {block.questions.map((q) => (
                        <li key={q.key}>
                          <button
                            type="button"
                            onClick={() => void ask(q.key)}
                            className="text-xs text-[#334155] hover:font-semibold text-left w-full hover:text-violet-700"
                          >
                            {q.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-[#94A3B8] mt-2">{block.questionCount} questions</p>
                  </div>
                );
              })}
            </div>
            <div
              className="mt-4 rounded-xl px-4 py-3 text-center text-xs font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${PURPLE}, #6D28D9)` }}
            >
              {hub.totalQuestions}+ questions across 4 categories. All answers are backed by system data.
            </div>
          </Card>

          <Card className="lg:col-span-4 p-5 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-bold text-[#0F172A]">Recent Questions You Asked</p>
              <Link href="/app/bhudhi?section=memory">
                <span className="text-[10px] font-semibold" style={{ color: PURPLE }}>
                  View History
                </span>
              </Link>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto">
              {hub.recentQuestions.length === 0 ? (
                <li className="text-xs text-[#94A3B8]">Ask a question above — Bhudhi will remember it here.</li>
              ) : (
                hub.recentQuestions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => void ask("why_this_task")}
                      className="w-full flex items-center justify-between gap-2 text-left p-2 rounded-lg hover:bg-gray-50 group"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{r.question}</p>
                        <p className="text-[10px] text-[#94A3B8] truncate">
                          {r.context ? `${r.context} · ` : ""}
                          {formatRelative(r.at)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>

        {/* Tip + principle */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5 flex gap-3 bg-amber-50/80 border-amber-100">
            <Lightbulb className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase text-amber-800">Tip</p>
              <p className="text-sm text-[#64748B] mt-1 leading-relaxed">
                The more you ask, the clearer your execution becomes. Use these questions to make better, faster
                decisions.
              </p>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4 border-violet-100 bg-gradient-to-r from-violet-50 to-white">
            <Target className="w-8 h-8 shrink-0" style={{ color: PURPLE }} />
            <div>
              <p className="text-sm font-bold text-[#0F172A]">Bhudhi explains. You decide. You execute.</p>
              <p className="text-xs text-[#64748B] mt-1">You are in control of your execution.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
