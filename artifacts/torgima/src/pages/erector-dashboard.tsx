import { Link } from "wouter";
import { Target, Box, GraduationCap, TrendingUp, Rocket } from "lucide-react";
import { ErectorFlowShell } from "@/components/erector/ErectorFlowShell";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";

const CARDS = [
  {
    title: "Validate New Idea",
    color: "border-emerald-500/40 bg-emerald-950/30",
    icon: Target,
    cta: "Start New Validation",
    href: "/onboarding",
    points: ["Market reality check", "Demand & competition", "Risk & path analysis"],
  },
  {
    title: "Project Simulator",
    color: "border-violet-500/40 bg-violet-950/30",
    icon: Box,
    cta: "Open Simulator",
    href: "/bhudhi/erector",
    points: ["Scenario modeling", "Path comparison", "What-if analysis"],
  },
  {
    title: "Academy & Skills",
    color: "border-amber-500/40 bg-amber-950/30",
    icon: GraduationCap,
    cta: "Go to Academy",
    href: "/academy",
    points: ["Execution frameworks", "Skill progression", "Learning paths"],
  },
  {
    title: "Industry Trends",
    color: "border-blue-500/40 bg-blue-950/30",
    icon: TrendingUp,
    cta: "View Industry Intelligence",
    href: "/signals",
    points: ["Market momentum", "Opportunity window", "Competitive landscape"],
  },
] as const;

export default function ErectorDashboardPage() {
  const { checking } = useAppRouteGuard("pre-launch");

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <ErectorFlowShell title="Erector Dashboard" subtitle="Validate ideas. Simulate paths. Prepare for execution.">
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map((card) => (
            <div key={card.title} className={`rounded-2xl border p-5 ${card.color}`}>
              <card.icon className="w-8 h-8 text-white/90 mb-3" />
              <h3 className="font-semibold text-white">{card.title}</h3>
              <ul className="mt-3 space-y-1 text-xs text-slate-400">
                {card.points.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
              <Link
                href={card.href}
                className="mt-4 inline-block w-full text-center rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                {card.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-violet-200 font-medium">Ready to validate a new direction?</p>
            <p className="text-xs text-slate-400 mt-1">Start with goal refinement, then run full Erector validation.</p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            <Rocket className="w-4 h-4" />
            Start Something New
          </Link>
        </div>
      </div>
    </ErectorFlowShell>
  );
}
