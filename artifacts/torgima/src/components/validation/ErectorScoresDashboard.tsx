import {
  ArrowRight,
  Clock,
  Download,
  Globe,
  Rocket,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import type { PathKey } from "@/components/validation/PathPanels";

export type ErectorPathCard = {
  title?: string;
  summary?: string;
  description?: string;
  expectedOutcome?: string;
  outcomeProjection?: string;
  growthPotential?: number | string;
  timeToTraction?: string;
  riskLevel?: string;
};

export type ErectorValidationReport = {
  validationId?: string;
  blueprintId?: string;
  rawGoal?: string;
  purpose?: string;
  verdict?: string;
  realityScore?: number;
  recommendedBlueprintLevel?: string;
  selectedPath?: PathKey;
  scores?: Record<string, number | string | undefined>;
  paths?: Partial<Record<PathKey, ErectorPathCard>>;
  industryPros?: string[];
  industryCons?: string[];
  targetCustomer?: string;
  desiredOutcome?: string;
  knownBlockers?: string[] | string;
  timeframe?: string;
  commitmentLevel?: string;
  economyBriefing?: Record<string, unknown>;
  archetypeResolution?: Record<string, unknown>;
};

function toScore100(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return 0;
  if (n <= 10) return Math.round(n * 10);
  return Math.round(Math.min(100, n));
}

function scoreTag(pct: number): { label: string; className: string } {
  if (pct >= 85) return { label: "Excellent", className: "text-green-600 bg-green-50" };
  if (pct >= 70) return { label: "Strong", className: "text-blue-600 bg-blue-50" };
  if (pct >= 55) return { label: "Moderate", className: "text-yellow-600 bg-yellow-50" };
  if (pct >= 40) return { label: "Weak", className: "text-orange-600 bg-orange-50" };
  return { label: "Critical", className: "text-red-600 bg-red-50" };
}

function verdictUi(verdict?: string): { label: string; className: string; hint: string } {
  switch (verdict) {
    case "proceed":
      return { label: "Proceed", className: "text-green-700 bg-green-100", hint: "Execution may proceed with current path." };
    case "adjust":
      return { label: "Adjust & proceed", className: "text-amber-700 bg-amber-100", hint: "Adjust path before full launch." };
    case "pivot":
      return { label: "Pivot required", className: "text-purple-700 bg-purple-100", hint: "Alternative path recommended." };
    case "blocked":
      return { label: "Blocked", className: "text-red-700 bg-red-100", hint: "Reality score blocks launch." };
    default:
      return { label: verdict ?? "Pending", className: "text-gray-700 bg-gray-100", hint: "Verdict pending." };
  }
}

function pathLabel(key?: PathKey): string {
  if (key === "adjusted") return "Adjusted path";
  if (key === "alternative") return "Alternative path";
  return "Current path";
}

function parsePath(raw: unknown): ErectorPathCard | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ErectorPathCard;
    } catch {
      return { summary: raw };
    }
  }
  return raw as ErectorPathCard;
}

function stringList(value: unknown, max: number): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, max);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function ConfidenceRing({ pct }: { pct: number }) {
  const RADIUS = 28;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke="#22C55E"
          strokeWidth="6"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{pct}%</span>
    </div>
  );
}

type ErectorScoresDashboardProps =
  | {
      report: ErectorValidationReport;
      onLaunch?: () => void;
      onDownload?: () => void;
      scores?: never;
      realityScore?: never;
      verdict?: never;
      recommendedBlueprintLevel?: never;
    }
  | {
      report?: never;
      onLaunch?: () => void;
      onDownload?: () => void;
      scores?: Record<string, number | string | undefined>;
      realityScore?: number;
      verdict?: string;
      recommendedBlueprintLevel?: string;
    };

export function buildErectorValidationReport(opts: {
  erector?: Record<string, unknown>;
  validation?: {
    validationId?: string;
    blueprintId?: string;
    verdict?: string;
    paths?: ErectorValidationReport["paths"];
  };
  form?: {
    primaryGoal?: string;
    purpose?: string;
    targetCustomer?: string;
    desiredOutcome?: string;
    timeframe?: string;
    commitmentLevel?: string;
    knownBlockers?: string[] | string;
  };
  selectedPath?: PathKey;
}): ErectorValidationReport {
  const erector = opts.erector ?? {};
  const scores = (erector.scores ?? {}) as Record<string, number | string | undefined>;
  const archetype = (erector.archetypeResolution ?? {}) as Record<string, unknown>;
  const blockersRaw = opts.form?.knownBlockers;
  const knownBlockers = Array.isArray(blockersRaw)
    ? blockersRaw
    : typeof blockersRaw === "string" && blockersRaw.trim()
      ? blockersRaw.includes(",")
        ? blockersRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : [blockersRaw.trim()]
      : [];
  const reality = Number(scores.realityScore ?? erector.realityScore ?? NaN);

  return {
    validationId: opts.validation?.validationId,
    blueprintId: opts.validation?.blueprintId,
    rawGoal: opts.form?.primaryGoal,
    purpose: opts.form?.purpose,
    targetCustomer: opts.form?.targetCustomer,
    desiredOutcome: opts.form?.desiredOutcome,
    timeframe: opts.form?.timeframe,
    commitmentLevel: opts.form?.commitmentLevel,
    knownBlockers,
    verdict: opts.validation?.verdict ?? String(scores.verdict ?? ""),
    realityScore: Number.isNaN(reality) ? undefined : reality,
    recommendedBlueprintLevel: String(scores.recommendedBlueprintLevel ?? ""),
    selectedPath: opts.selectedPath,
    scores,
    paths:
      opts.validation?.paths ??
      (erector.paths as ErectorValidationReport["paths"]),
    economyBriefing: erector.economyBriefing as Record<string, unknown> | undefined,
    archetypeResolution: archetype,
    industryPros: stringList(archetype.economySpecificOpportunities, 5),
    industryCons: stringList(archetype.economySpecificWarnings, 4),
  };
}

export function ErectorScoresDashboard(props: ErectorScoresDashboardProps) {
  if (!props.report && !props.scores) return null;
  const report: ErectorValidationReport =
    props.report ??
    buildErectorValidationReport({
      erector: { scores: props.scores },
      validation: {
        verdict: props.verdict,
      },
    });
  if (props.realityScore != null && !Number.isNaN(props.realityScore)) {
    report.realityScore = props.realityScore;
  }
  if (props.verdict) report.verdict = props.verdict;
  if (props.recommendedBlueprintLevel) {
    report.recommendedBlueprintLevel = props.recommendedBlueprintLevel;
  }
  return (
    <ErectorScoresDashboardView
      report={report}
      onLaunch={props.onLaunch}
      onDownload={props.onDownload}
    />
  );
}

function ErectorScoresDashboardView({
  report,
  onLaunch,
  onDownload,
}: {
  report: ErectorValidationReport;
  onLaunch?: () => void;
  onDownload?: () => void;
}) {
  const scores = report.scores ?? {};
  const realityRaw = report.realityScore ?? scores.realityScore;
  const confidencePct = toScore100(realityRaw);
  const verdict = verdictUi(report.verdict ?? String(scores.verdict ?? ""));
  const paths = {
    current: parsePath(report.paths?.current),
    adjusted: parsePath(report.paths?.adjusted),
    alternative: parsePath(report.paths?.alternative),
  };
  const briefing = report.economyBriefing ?? {};
  const archetype = report.archetypeResolution ?? {};
  const opportunities =
    stringList(report.industryPros, 5).length > 0
      ? stringList(report.industryPros, 5)
      : stringList(briefing.keyOpportunities ?? archetype.economySpecificOpportunities, 5);
  const risks =
    stringList(report.industryCons, 4).length > 0
      ? stringList(report.industryCons, 4)
      : stringList(briefing.keyWarnings ?? archetype.economySpecificWarnings, 4);
  const blockers = Array.isArray(report.knownBlockers)
    ? report.knownBlockers
    : report.knownBlockers
      ? [report.knownBlockers]
      : [];

  const scoreCards = [
    { label: "Market reality", icon: Globe, key: "marketScore", bar: "bg-blue-500", desc: "Market demand vs goal." },
    { label: "Demand signal", icon: TrendingUp, key: "timingScore", bar: "bg-green-500", desc: "Timing and demand window." },
    { label: "Competitor pressure", icon: Users, key: "competitionScore", bar: "bg-yellow-500", desc: "Competitive density." },
    { label: "Feasibility", icon: Wrench, key: "executionScore", bar: "bg-green-500", desc: "Execution capacity fit." },
    { label: "Timing", icon: Clock, key: "timingScore", bar: "bg-yellow-500", desc: "Time-to-traction alignment." },
  ];

  const recommendedPath: PathKey =
    report.verdict === "adjust" ? "adjusted" : report.selectedPath ?? "current";

  return (
    <div className="rounded-2xl overflow-hidden border border-[#1B1F2E] bg-[#0C0E14] text-gray-100 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-[#1B1F2E] sticky top-0 z-10 bg-[#0C0E14]/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-[0.2em] text-green-400">ERECTOR</span>
          <span className="text-xs text-gray-500">Validation report</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-green-400">Validation complete</p>
          <p className="text-[11px] text-gray-500">Reality analysis ready for path selection</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownload ?? (() => window.print())}
            className="inline-flex items-center gap-1 rounded-lg border border-[#2A3044] px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-[#151925]"
          >
            <Download className="w-3.5 h-3.5" />
            Download report
          </button>
          <button
            type="button"
            onClick={onLaunch}
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
          >
            <Rocket className="w-3.5 h-3.5" />
            Launch blueprint
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8 bg-gray-50 text-gray-900 rounded-b-2xl">
        <section className="grid lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Goal</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">{report.rawGoal ?? "Execution goal"}</h2>
            {report.purpose && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{report.purpose}</p>}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Final verdict</p>
            <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${verdict.className}`}>
              {verdict.label}
              <ArrowRight className="w-4 h-4" />
            </p>
            <p className="mt-2 text-xs text-gray-600">{verdict.hint}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col items-center justify-center gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Confidence score</p>
            <ConfidenceRing pct={confidencePct} />
            <p className="text-xs text-gray-500">Composite reality /100</p>
          </div>
          <div className="lg:col-span-4 rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Selected path</p>
            <p className="mt-1 text-lg font-semibold">{pathLabel(report.selectedPath)}</p>
            <p className="text-sm text-gray-600">
              {paths[report.selectedPath ?? "current"]?.summary ??
                paths[report.selectedPath ?? "current"]?.description ??
                "Path selection continues in onboarding."}
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Reality scorecards</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {scoreCards.map(({ label, icon: Icon, key, bar, desc }) => {
              const pct = toScore100(scores[key]);
              const tag = scoreTag(pct);
              return (
                <div key={key + label} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-gray-700 mb-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{label}</span>
                  </div>
                  <p className="text-2xl font-bold">{pct}</p>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tag.className}`}>
                    {tag.label}
                  </span>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">{desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Path analysis</h3>
          <div className="grid lg:grid-cols-3 gap-4 relative">
            {(["current", "adjusted", "alternative"] as PathKey[]).map((key, index) => {
              const path = paths[key];
              if (!path) return null;
              const isRecommended = key === recommendedPath;
              return (
                <div key={key} className="relative">
                  {isRecommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-amber-400 px-3 py-0.5 text-[10px] font-bold text-amber-950">
                      RECOMMENDED
                    </span>
                  )}
                  <div
                    className={`rounded-2xl border-2 bg-white p-4 h-full ${isRecommended ? "border-amber-400" : "border-gray-200"}`}
                  >
                    <p className="text-xs font-bold uppercase text-gray-500">{pathLabel(key)}</p>
                    <p className="mt-1 font-semibold text-gray-900">{path.title ?? pathLabel(key)}</p>
                    <p className="mt-2 text-sm text-gray-600">{path.description ?? path.summary}</p>
                    <p className="mt-3 text-[10px] font-bold uppercase text-gray-400">Outcome projection</p>
                    <p className="text-sm font-medium text-green-700">
                      {path.outcomeProjection ?? path.expectedOutcome ?? "—"}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                      <div>
                        <p className="font-semibold text-gray-800">Growth</p>
                        <p>{path.growthPotential != null ? `${path.growthPotential}%` : "—"}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Traction</p>
                        <p>{path.timeToTraction ?? "—"}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Risk</p>
                        <p>{path.riskLevel ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                  {index < 2 && (
                    <span className="hidden lg:flex absolute -right-3 top-1/2 z-20 w-6 h-6 rounded-full bg-gray-900 text-white text-[10px] items-center justify-center font-bold">
                      VS
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Risk summary</h3>
            <div className="space-y-2">
              {risks.length === 0 && <p className="text-sm text-gray-500">No elevated risks flagged.</p>}
              {risks.map((risk, i) => (
                <div key={risk} className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${i === 0 ? "bg-red-200 text-red-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {i === 0 ? "High" : "Medium"}
                  </span>
                  <p className="mt-2 text-sm text-gray-800">{risk}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Opportunity areas</h3>
            <div className="space-y-2">
              {opportunities.length === 0 && <p className="text-sm text-gray-500">No opportunities listed.</p>}
              {opportunities.map((item) => (
                <div key={item} className="rounded-xl border border-green-100 bg-green-50/60 p-3 text-sm text-gray-800">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Blueprint readiness</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-gray-500">Direction</p>
              <p className="mt-2 text-sm font-semibold capitalize">
                {report.recommendedBlueprintLevel ?? "starter"} tier
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-gray-500">Target user</p>
              <p className="mt-2 text-sm text-gray-700">{report.targetCustomer ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-gray-500">Success definition</p>
              <p className="mt-2 text-sm text-gray-700">{report.desiredOutcome ?? report.purpose ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase text-gray-500">Constraints</p>
              <p className="mt-2 text-sm text-gray-700">
                {[report.timeframe, report.commitmentLevel, ...blockers].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-gray-900">Ready to execute</p>
            <p className="text-sm text-gray-600">Launch blueprint or export this validation report.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDownload ?? (() => window.print())}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Download report
            </button>
            <button
              type="button"
              onClick={onLaunch}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Launch blueprint
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
