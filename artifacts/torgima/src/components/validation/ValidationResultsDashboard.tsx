import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  Compass,
  Download,
  Info,
  Infinity,
  Pencil,
  Rocket,
  Shield,
  Target,
  X,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import type { PathKey } from "./PathPanels";
import type { ValidationScreenData } from "./ValidationScreen";
import { ExplanationPanel } from "@/components/erector/ExplanationPanel";
import {
  buildResultsDashboardModel,
  glanceExplanation,
  type GlanceRow,
  type StatusTone,
} from "./validation-results-dashboard-model";
import { LANGUAGE, getProjectDisplayName, getVerdictDisplay } from "@/lib/language";
import { validateProjectNameInput } from "@/lib/project-name";
import {
  CompetitorsSection,
  EconomicEnvironmentSection,
  OpportunitiesSection,
} from "./ValidationEnrichedSections";

const CARD = "rounded-[20px] border border-[#ECECF4] bg-white shadow-sm";

function toneClass(tone: StatusTone): string {
  if (tone === "green") return "text-emerald-600 bg-emerald-50";
  if (tone === "orange") return "text-amber-600 bg-amber-50";
  if (tone === "red") return "text-red-600 bg-red-50";
  if (tone === "purple") return "text-[#5B21FF] bg-[#F5F3FF]";
  return "text-[#64748B] bg-[#F8FAFC]";
}

function RealityRing({ pct }: { pct: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const stroke = pct >= 70 ? "#22C55E" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative mx-auto h-[140px] w-[140px]">
      <svg width="140" height="140" viewBox="0 0 120 120" className="mx-auto">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F1F5F9" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[#0B1220]">
        {pct}%
      </span>
    </div>
  );
}

function TrendChart({ years, values }: { years: string[]; values: number[] }) {
  const w = 280;
  const h = 100;
  const pad = 8;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
        <polyline
          fill="none"
          stroke="#5B21FF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {values.map((v, i) => {
          const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
          const y = h - pad - ((v - min) / range) * (h - pad * 2);
          return <circle key={years[i]} cx={x} cy={y} r="4" fill="#5B21FF" />;
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-[#94A3B8]">
        {years.map((y) => (
          <span key={y}>{y}</span>
        ))}
      </div>
    </div>
  );
}

function GlanceBadge({ row }: { row: GlanceRow }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] py-2.5 last:border-0">
      <span className="text-xs font-medium text-[#64748B]">{row.label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${toneClass(row.tone)}`}>
        {row.value}
      </span>
    </div>
  );
}

const PIPELINE = [
  { label: "Input", done: true },
  { label: "Analysis", done: true },
  { label: "Reality Check", done: true },
  { label: "Path Analysis", done: true },
  { label: "Results", done: false, active: true },
];

export function ValidationResultsDashboard({
  data,
  validationId,
  selectedPath,
  onSelectPath,
  onLaunch,
  onDownload,
  downloading,
  downloadError,
  launching,
  launchError,
  launchReady = true,
  timeframeMissing,
  onEditContext,
  projectName = "",
  editingProjectName = false,
  onEditProjectName,
  onProjectNameChange,
  onProjectNameEditDone,
  goalSummary,
  explanationsLoading,
}: {
  data: ValidationScreenData;
  validationId?: string;
  selectedPath: PathKey;
  onSelectPath: (p: PathKey) => void;
  onLaunch: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  downloadError?: string;
  launching?: boolean;
  launchError?: string;
  launchReady?: boolean;
  timeframeMissing?: boolean;
  onEditContext?: () => void;
  projectName?: string;
  editingProjectName?: boolean;
  onEditProjectName?: () => void;
  onProjectNameChange?: (name: string) => void;
  onProjectNameEditDone?: () => void;
  goalSummary?: string;
  explanationsLoading?: boolean;
}) {
  const { data: me } = useGetMe();
  const [scoreHelpOpen, setScoreHelpOpen] = useState(false);
  const model = useMemo(
    () => buildResultsDashboardModel(data, selectedPath, { explanationsLoading }),
    [data, selectedPath, explanationsLoading],
  );
  const exp = model.explanations;
  const expLoading = model.explanationsLoading;

  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Visionary";
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const dayLabel = today.toLocaleDateString("en-US", { weekday: "long" });

  const verdictDisplay = getVerdictDisplay(model.verdictUpper);
  const [nameError, setNameError] = useState("");

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* Header */}
        <header className="flex flex-col items-stretch gap-6 border-b border-[#ECECF4] pb-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/erector"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#5B21FF] hover:text-[#6D28D9]"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Erector
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1220]">Validation Results</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#64748B]">
              Reality check complete.
              <br />
              Here&apos;s what we found and recommend.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className={`${CARD} flex items-center gap-3 px-4 py-2.5`}>
              <Calendar className="h-4 w-4 text-[#5B21FF]" />
              <div>
                <p className="text-sm font-semibold text-[#0B1220]">{dateLabel}</p>
                <p className="text-xs text-[#94A3B8]">{dayLabel}</p>
              </div>
            </div>
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#ECECF4] bg-white hover:bg-[#F8FAFC]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-[#64748B]" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#5B21FF] text-[9px] font-bold text-white">
                3
              </span>
            </button>
            <button
              type="button"
              className={`${CARD} flex items-center gap-2 px-3 py-2`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5B21FF] to-[#6D28D9] text-sm font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-[#0B1220]">{displayName}</p>
                <p className="text-xs text-[#94A3B8]">Level 7</p>
              </div>
              <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
            </button>
            <div className="w-full sm:w-auto sm:text-right">
              <button
                type="button"
                disabled={downloading}
                onClick={onDownload}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1220] hover:bg-[#F8FAFC] disabled:opacity-60 sm:w-auto"
              >
                <Download className={`h-4 w-4 ${downloading ? "animate-pulse" : ""}`} />
                {downloading ? LANGUAGE.states.preparing : LANGUAGE.validation.download}
              </button>
              {downloadError ? (
                <p className="mt-1 text-xs text-red-600">{downloadError}</p>
              ) : null}
            </div>
            <div className="w-full sm:w-auto sm:text-right">
              <button
                type="button"
                disabled={launching || data.launchBlocked || !launchReady}
                onClick={onLaunch}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200/50 hover:opacity-95 disabled:opacity-50 sm:w-auto"
              >
                <Rocket className="h-4 w-4" />
                {launching ? LANGUAGE.validation.launching : LANGUAGE.validation.launchButton}
              </button>
              <p className="mt-1 text-[11px] text-[#94A3B8]">{LANGUAGE.validation.launchSubtext}</p>
            </div>
          </div>
        </header>

        <section className={`${CARD} mt-8 p-6 sm:p-8`}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B21FF]">
            {LANGUAGE.project.yourProject}
          </p>
          <hr className="my-4 border-[#ECECF4]" />
          {editingProjectName ? (
            <div className="space-y-3">
              <input
                value={projectName}
                onChange={(e) => {
                  onProjectNameChange?.(e.target.value.slice(0, 50));
                  setNameError("");
                }}
                className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-lg font-bold outline-none focus:border-[#5B21FF]"
                maxLength={50}
              />
              {nameError ? <p className="text-xs text-red-600">{nameError}</p> : null}
              <button
                type="button"
                onClick={() => {
                  const err = validateProjectNameInput(projectName);
                  if (err) {
                    setNameError(err);
                    return;
                  }
                  onProjectNameEditDone?.();
                }}
                className="rounded-lg bg-[#5B21FF] px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-[#0B1220]">
                {getProjectDisplayName(projectName, goalSummary ?? null)}
              </h2>
              <button
                type="button"
                onClick={onEditProjectName}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#5B21FF]"
              >
                <Pencil className="h-4 w-4" />
                {LANGUAGE.project.editName}
              </button>
            </div>
          )}
          {goalSummary ? (
            <p className="mt-4 text-sm text-[#64748B]">
              <span className="font-semibold text-[#0B1220]">Goal: </span>
              {goalSummary}
            </p>
          ) : null}
        </section>

        {launchError ? (
          <pre className="mt-6 whitespace-pre-wrap rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700">
            {launchError}
          </pre>
        ) : null}

        {timeframeMissing ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Timeframe is missing</p>
            <p className="mt-1 text-xs text-amber-800">
              Please return to the context step and select a timeframe before launching.
            </p>
            {onEditContext ? (
              <button
                type="button"
                onClick={onEditContext}
                className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                Edit validation context
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Pipeline */}
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-0" aria-label="Validation pipeline">
          {PIPELINE.map((step, i) => (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 px-2 sm:px-4">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                    step.active
                      ? "bg-[#5B21FF] text-white shadow-md shadow-violet-200"
                      : step.done
                        ? "bg-emerald-500 text-white"
                        : "border border-[#E2E8F0] bg-white text-[#94A3B8]"
                  }`}
                >
                  {step.done && !step.active ? <Check className="h-4 w-4" strokeWidth={3} /> : step.active ? "5" : null}
                </span>
                <span
                  className={`text-center text-[11px] font-semibold ${
                    step.active ? "text-[#5B21FF]" : step.done ? "text-emerald-600" : "text-[#94A3B8]"
                  }`}
                >
                  {step.label}
                </span>
                {step.done && !step.active ? (
                  <span className="text-[10px] text-emerald-600">Completed</span>
                ) : step.active ? (
                  <span className="text-[10px] text-[#5B21FF]">Complete</span>
                ) : null}
              </div>
              {i < PIPELINE.length - 1 ? (
                <div className={`mx-1 hidden h-px w-8 sm:block md:w-16 ${step.done ? "bg-emerald-300" : "bg-[#E2E8F0]"}`} />
              ) : null}
            </div>
          ))}
        </nav>

        {/* Idea summary strip */}
        <section className={`${CARD} mt-10 p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Your Idea</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-[#0B1220]">{model.ideaTitle}</h2>
                <Link
                  href="/validate"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B21FF] hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Link>
              </div>
              <p className="mt-1 text-sm text-[#64748B]">{model.ideaSubtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Selected Direction</p>
              <p className="mt-1 text-sm font-bold text-emerald-600">{model.selectedDirectionLabel}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex gap-3">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" />
              <div>
                <p className="text-xs font-semibold text-[#94A3B8]">Goal</p>
                <p className="mt-0.5 text-sm font-medium text-[#0B1220]">{model.rawGoal || "—"}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Infinity className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" />
              <div>
                <p className="text-xs font-semibold text-[#94A3B8]">Purpose</p>
                <p className="mt-0.5 text-sm font-medium text-[#0B1220] line-clamp-2">{model.purpose || "—"}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" />
              <div>
                <p className="text-xs font-semibold text-[#94A3B8]">Timeframe</p>
                <p className="mt-0.5 text-sm font-medium text-[#0B1220]">{model.timeframeLabel}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Compass className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" />
              <div>
                <p className="text-xs font-semibold text-[#94A3B8]">Context</p>
                <p className="mt-0.5 text-sm font-medium text-[#0B1220]">{model.contextLabel}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Row 1: Score, Verdict, Glance, Trends */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <section className={`${CARD} lg:col-span-3 p-6`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Reality Score</p>
            <ExplanationPanel text={exp.reality_score} isLoading={expLoading} />
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <RealityRing pct={model.ringPct} />
              <div className="text-center sm:text-left">
                <p className="text-lg font-bold text-emerald-600">{model.realityLabel}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{model.realityDescription}</p>
                <button
                  type="button"
                  onClick={() => setScoreHelpOpen((o) => !o)}
                  className="mt-3 text-xs font-semibold text-[#5B21FF] hover:underline"
                >
                  What does this score mean? →
                </button>
                {scoreHelpOpen ? (
                  <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
                    The reality score blends market demand, competition, timing, execution fit, and feasibility into one
                    readiness number before you commit to a direction.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`${CARD} lg:col-span-3 flex flex-col items-center justify-center p-6 text-center`}>
            <Shield className="h-10 w-10 text-emerald-500" strokeWidth={1.5} />
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Final Verdict</p>
            <div className="w-full text-left">
              <ExplanationPanel text={exp.final_verdict} isLoading={expLoading} />
            </div>
            <p
              className="mt-2 text-3xl font-black tracking-tight"
              style={{ color: verdictDisplay.color }}
            >
              {verdictDisplay.icon} {verdictDisplay.label}
            </p>
            <p className="mt-2 text-sm text-[#64748B]">{model.verdictDescription}</p>
            <span className="mt-4 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700">
              {model.confidenceBadge}
            </span>
          </section>

          <section className={`${CARD} lg:col-span-3 p-6`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">At a Glance</p>
            <div className="mt-3">
              {model.atAGlance.map((row) => (
                <div key={row.label}>
                  <GlanceBadge row={row} />
                  <ExplanationPanel
                    text={glanceExplanation(exp, row.label)}
                    isLoading={expLoading}
                    defaultExpanded={false}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className={`${CARD} lg:col-span-3 p-6`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Current Trends</p>
            <ExplanationPanel text={exp.market_trends} isLoading={expLoading} />
            <div className="mt-4">
              <TrendChart years={model.chartYears} values={model.chartValues} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Trend Position</p>
                <p className="text-sm font-bold text-[#0B1220]">{model.trendPosition}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[#94A3B8]">Growth Rate</p>
                <p className="text-sm font-bold text-emerald-600">{model.growthRate}</p>
              </div>
            </div>
          </section>
        </div>

        <EconomicEnvironmentSection economic={model.economicContext} />

        {/* Row 2: Competitors, Pros/Cons, Opportunities */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <CompetitorsSection
            competitors={model.enrichedCompetitors}
            overviewExplanation={exp.competitors_overview}
            explanationsLoading={expLoading}
          />

          <section className={`${CARD} lg:col-span-4 overflow-hidden p-0`}>
            <p className="border-b border-[#F1F5F9] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#0B1220]">
              Pros &amp; Cons
            </p>
            <div className="px-5 pb-2">
              <ExplanationPanel text={exp.pros_cons} isLoading={expLoading} />
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="border-[#F1F5F9] p-5 sm:border-r">
                <p className="text-xs font-bold uppercase text-emerald-600">Pros</p>
                <ul className="mt-3 space-y-2">
                  {model.pros.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-[#475569]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase text-red-500">Cons</p>
                <ul className="mt-3 space-y-2">
                  {model.cons.map((c) => (
                    <li key={c} className="flex gap-2 text-sm text-[#475569]">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" strokeWidth={2.5} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <OpportunitiesSection
            opportunities={model.enrichedOpportunities}
            overviewExplanation={exp.opportunities}
            explanationsLoading={expLoading}
          />
        </div>

        {/* Row 3: Paths, Risks, Success Plan */}
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[#0B1220]">Path Outcomes Comparison</p>
            <div className="grid gap-4 md:grid-cols-3">
              {model.pathCards.map((path) => {
                const selected = selectedPath === path.key;
                const pathExplanation =
                  path.key === "current"
                    ? exp.path_current
                    : path.key === "adjusted"
                      ? exp.path_adjusted
                      : exp.path_alternative;
                return (
                  <button
                    key={path.key}
                    type="button"
                    onClick={() => onSelectPath(path.key)}
                    className={`${CARD} relative p-4 text-left transition-all ${
                      selected ? "border-[#5B21FF] ring-2 ring-[#5B21FF]/20" : "hover:border-[#C7D2FE]"
                    }`}
                  >
                    <ExplanationPanel text={pathExplanation} isLoading={expLoading} defaultExpanded={false} />
                    {path.badge ? (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-[10px] font-bold text-amber-950">
                        {path.badge}
                      </span>
                    ) : null}
                    <p className="text-xs font-bold uppercase text-[#94A3B8]">{path.title}</p>
                    <p className="mt-2 text-sm font-semibold capitalize text-[#0B1220]">{path.successPotential}</p>
                    <p className="mt-2 text-xs text-[#64748B]">{path.growthPotential}</p>
                    <p className="mt-3 text-xs">
                      <span className="font-semibold text-[#0B1220]">Time to traction:</span> {path.timeToTraction}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B] line-clamp-2">{path.estimatedOutcome}</p>
                    {selected ? (
                      <span className="mt-3 inline-block text-[10px] font-bold text-[#5B21FF]">Selected ✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${CARD} lg:col-span-3 p-5`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#0B1220]">Risk Summary</p>
            <ExplanationPanel text={exp.risks} isLoading={expLoading} />
            <ul className="mt-4 space-y-4">
              {model.risks.map((risk) => (
                <li key={risk.title}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#0B1220]">{risk.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        risk.level === "Low"
                          ? "bg-emerald-50 text-emerald-700"
                          : risk.level === "Medium"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {risk.level}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{risk.explanation}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${CARD} lg:col-span-4 p-5`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#0B1220]">Success Plan</p>
            <ExplanationPanel text={exp.success_plan} isLoading={expLoading} />
            <p className="mt-0.5 text-xs text-[#94A3B8]">Key milestones</p>
            <ol className="mt-5 space-y-4">
              {model.milestones.map((m) => (
                <li key={m.step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5B21FF] text-sm font-bold text-white">
                    {m.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0B1220]">{m.title}</p>
                    <p className="text-xs text-[#94A3B8]">{m.timing}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Direction anchor */}
        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-[#C7D2FE] bg-[#F5F3FF]/60 px-6 py-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" />
            <div>
              <p className="text-sm font-bold text-[#0B1220]">
                This validation is now saved as your Direction Anchor.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                Use it to stay aligned, make better decisions, and adjust your strategy as you execute.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#5B21FF]/30 bg-white px-4 py-2 text-sm font-semibold text-[#5B21FF] hover:bg-white/80"
          >
            View Saved Validation →
          </button>
        </section>

        {/* Bottom CTA */}
        <div className="mt-10 flex flex-wrap items-center justify-end gap-4 border-t border-[#ECECF4] pt-8">
          <button
            type="button"
            disabled={launching || data.launchBlocked || !launchReady}
            onClick={onLaunch}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-10 py-4 text-base font-bold text-white shadow-xl shadow-violet-200/60 hover:opacity-95 disabled:opacity-50"
          >
            <Rocket className="h-5 w-5" />
            {launching ? LANGUAGE.validation.launching : LANGUAGE.validation.launchButton}
          </button>
        </div>
      </div>
    </div>
  );
}
