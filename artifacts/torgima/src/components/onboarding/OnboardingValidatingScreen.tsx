import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Circle,
  Loader2,
  Rocket,
  Shield,
  Zap,
} from "lucide-react";
import { PreValidationStepper } from "@/components/pre-validation/PreValidationStepper";
import { TorgimaPreLaunchLogo } from "@/components/pre-validation/TorgimaPreLaunchLogo";
import {
  computeDurationMonths,
  formatDisplayDate,
  weeklyCommitmentContextLabel,
  type PreValidationDraft,
} from "@/lib/pre-validation-draft";

const STAGES = [
  { id: 1, title: "Goal Understanding", sub: "Understanding your core objective." },
  { id: 2, title: "Purpose Decomposition", sub: "Breaking down your purpose into core claims." },
  { id: 3, title: "Reality Matching", sub: "Matching your idea across reality dimensions." },
  { id: 4, title: "Market Analysis", sub: "Analyzing market size, demand & growth." },
  { id: 5, title: "Competitor Analysis", sub: "Scanning competitors and solution landscape." },
  { id: 6, title: "Opportunity Detection", sub: "Identifying gaps and high-opportunity areas." },
  { id: 7, title: "Risk Identification", sub: "Evaluating execution, market and resource risks." },
  { id: 8, title: "Path Generation", sub: "Generating current, adjusted and alternative paths." },
  { id: 9, title: "Final Recommendation", sub: "Compiling insights and final verdict." },
] as const;

const INSIGHTS = [
  { stage: 4, text: "Strong market demand detected — High search volume and engagement trend found.", tone: "ok" as const },
  { stage: 5, text: "3 major competitors identified — Moderate competition with room for differentiation.", tone: "ok" as const },
  { stage: 4, text: "Growth trend detected — Market is growing in this niche.", tone: "ok" as const },
  { stage: 6, text: "Timing is favorable — Market momentum is in your favor right now.", tone: "ok" as const },
  { stage: 7, text: "Resource constraints detected — Time and team capacity may limit scale.", tone: "warn" as const },
  { stage: 6, text: "Analyzing opportunity score — Calculating overall opportunity strength.", tone: "pending" as const },
  { stage: 7, text: "Scanning industry risks — Evaluating market, execution and external risks.", tone: "pending" as const },
  { stage: 8, text: "Generating strategic paths — Building current, adjusted and alternative paths.", tone: "pending" as const },
  { stage: 9, text: "Preparing final recommendation — Compiling final insights and validation verdict.", tone: "pending" as const },
];

const ENGINES = [
  "Market Scanner",
  "Competitor Scanner",
  "Opportunity Engine",
  "Risk Engine",
  "Path Generator",
  "Insight Compiler",
];

const STAGE_MS = 6500;
const MIN_SCREEN_MS = 30000;

export function OnboardingValidatingScreen({
  draft,
  pollStatus,
  onComplete,
}: {
  draft: PreValidationDraft;
  pollStatus: () => Promise<{ status: string; progress: number }>;
  onComplete: () => void;
}) {
  const [activeStage, setActiveStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [apiComplete, setApiComplete] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [pollNote, setPollNote] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());

  const months = computeDurationMonths(draft.startDate, draft.endDate);
  const durationLabel = months === 1 ? "1 month" : `${months} months`;
  const timeframeLabel = `${formatDisplayDate(draft.startDate)} – ${formatDisplayDate(draft.endDate)} (${durationLabel})`;

  const visibleInsights = useMemo(
    () => INSIGHTS.filter((i) => i.stage <= activeStage + 1),
    [activeStage],
  );

  useEffect(() => {
    void pollStatus().then(({ status }) => {
      if (
        status === "complete" ||
        status === "completed" ||
        status === "validated" ||
        status === "finalized"
      ) {
        setApiComplete(true);
        setProgress(100);
        setActiveStage(STAGES.length - 1);
      }
    });
  }, [pollStatus]);

  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), MIN_SCREEN_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStage((s) => {
        const next = Math.min(s + 1, STAGES.length - 1);
        setProgress(Math.round(((next + 1) / STAGES.length) * 100));
        return next;
      });
    }, STAGE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let retries = 0;
    const poll = window.setInterval(() => {
      void pollStatus()
        .then(({ status }) => {
          if (
            status === "complete" ||
            status === "completed" ||
            status === "validated" ||
            status === "finalized"
          ) {
            setApiComplete(true);
            setProgress(100);
          }
        })
        .catch(() => {
          retries += 1;
          if (retries >= 3) {
            setPollNote("Analysis taking longer than expected. Please wait…");
          }
        });
    }, 3000);
    return () => window.clearInterval(poll);
  }, [pollStatus]);

  useEffect(() => {
    if (apiComplete && minElapsed && activeStage >= STAGES.length - 1) {
      const t = window.setTimeout(onComplete, 800);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [apiComplete, minElapsed, activeStage, onComplete]);

  const etaSec = Math.max(0, Math.round((MIN_SCREEN_MS - (Date.now() - startedAt)) / 1000));

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-[1536px] flex-wrap items-start justify-between gap-4 px-6 pb-2 pt-6 lg:px-10">
        <TorgimaPreLaunchLogo />
        <div className="hidden flex-1 justify-center lg:flex">
          <PreValidationStepper current={4} />
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] px-4 py-3 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Zap className="h-4 w-4 text-[#5B21FF]" />
            FAST SETUP MODE
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 text-center lg:hidden">
        <PreValidationStepper current={4} />
      </div>

      <div className="mx-auto max-w-4xl px-6 pt-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EDE9FE]">
          <Rocket className="h-8 w-8 text-[#5B21FF]" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          ERECTOR IS ANALYZING YOUR IDEA
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-[#64748B]">
          We are evaluating your idea against market reality, execution feasibility, competition,
          timing, resources, and opportunity.
        </p>
      </div>

      <main className="mx-auto grid max-w-[1536px] gap-8 px-6 pb-52 pt-8 lg:grid-cols-[1fr_340px] lg:px-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#0B1220]">
              Validation Stages
            </h2>
            <ul className="mt-4 space-y-3">
              {STAGES.map((stage, idx) => {
                const done = idx < activeStage;
                const active = idx === activeStage;
                return (
                  <li
                    key={stage.id}
                    className={`flex items-start gap-3 rounded-xl px-3 py-2 ${active ? "bg-[#F5F3FF]" : ""}`}
                  >
                    {done ? (
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : active ? (
                      <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#5B21FF]" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[#CBD5E1]" />
                    )}
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-[#5B21FF]" : "text-[#0B1220]"}`}>
                        {stage.title}
                      </p>
                      <p className="text-xs text-[#64748B]">{stage.sub}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#0B1220]">
                Live Insights
              </h2>
              <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[10px] font-bold text-[#5B21FF]">
                Real-time
              </span>
            </div>
            <ul className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
              {visibleInsights.map((insight, i) => (
                <li
                  key={`${insight.text}-${i}`}
                  className="flex items-start gap-2 rounded-lg border border-[#F1F5F9] bg-[#FAFAFA] px-3 py-2 text-xs"
                >
                  {insight.tone === "warn" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  ) : insight.tone === "ok" ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#5B21FF]" />
                  )}
                  <span className="text-[#475569]">{insight.text}</span>
                </li>
              ))}
            </ul>
            {pollNote ? <p className="mt-3 text-xs text-amber-700">{pollNote}</p> : null}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide">Validation Summary</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div>
                <dt className="text-[#94A3B8]">Goal</dt>
                <dd className="font-medium text-[#0B1220]">{draft.goal.slice(0, 120)}</dd>
              </div>
              <div>
                <dt className="text-[#94A3B8]">Purpose</dt>
                <dd className="font-medium text-[#0B1220]">{draft.purpose.slice(0, 120)}</dd>
              </div>
              <div>
                <dt className="text-[#94A3B8]">Location</dt>
                <dd>{draft.countryName || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#94A3B8]">Industry</dt>
                <dd>{draft.quickContext.domain || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#94A3B8]">Timeframe</dt>
                <dd>{timeframeLabel}</dd>
              </div>
              <div>
                <dt className="text-[#94A3B8]">Commitment</dt>
                <dd>{weeklyCommitmentContextLabel(draft.weeklyCommitment)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">
              Validation Progress
            </p>
            <div className="relative mx-auto mt-4 h-28 w-28">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="2.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#5B21FF"
                  strokeWidth="2.5"
                  strokeDasharray={`${progress} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#5B21FF]">
                {progress}%
              </span>
            </div>
            <p className="mt-2 text-xs text-[#64748B]">
              Est. time remaining: {etaSec > 0 ? `${etaSec} sec` : "almost done"}
            </p>
            <p className="mt-2 text-[11px] text-[#94A3B8]">
              Please don&apos;t close this window while we analyze your idea.
            </p>
          </section>

          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide">Erector Engine Status</h3>
            <ul className="mt-3 space-y-2">
              {ENGINES.map((name) => (
                <li key={name} className="flex items-center justify-between text-xs">
                  <span>{name}</span>
                  <span className="font-semibold text-emerald-600">Active</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-[1536px] flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <div className="flex max-w-md items-start gap-2 text-xs text-[#64748B]">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#5B21FF]" />
            <span>
              Erector is building your validation using real market signals, competition data,
              execution intelligence, and opportunity analysis.
            </span>
          </div>
          <p className="text-xs font-medium text-[#64748B]">
            Your blueprint has NOT been created yet. It will be created after validation is complete.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-6 py-2.5 text-sm font-bold text-white opacity-80"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating Results…
          </button>
        </div>
      </div>
    </div>
  );
}
