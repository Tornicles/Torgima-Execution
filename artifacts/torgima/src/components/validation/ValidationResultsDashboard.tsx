import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Flag,
  Lightbulb,
  Rocket,
  Shield,
  Star,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import type { PathKey } from "./PathPanels";
import type { ValidationScreenData } from "./ValidationScreen";
import { PageHeader } from "@/components/design-system/PageHeader";
import { StatCard } from "@/components/design-system/StatCard";

function score100(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return v <= 10 ? Math.round(v * 10) : Math.round(v);
}

function parsePath(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { description: raw };
    }
  }
  return raw as Record<string, unknown>;
}

const PATH_LABELS: Record<PathKey, string> = {
  current: "Current Path",
  adjusted: "Adjusted Path",
  alternative: "Alternative Path",
};

export function ValidationResultsDashboard({
  data,
  completedLabel = "Completed",
  selectedPath,
  onSelectPath,
  onLaunch,
  onDownload,
  launching,
  launchError,
}: {
  data: ValidationScreenData;
  completedLabel?: string;
  selectedPath: PathKey;
  onSelectPath: (p: PathKey) => void;
  onLaunch: () => void;
  onDownload?: () => void;
  launching?: boolean;
  launchError?: string;
}) {
  const erector = data.intelligence?.erector as Record<string, unknown> | undefined;
  const scores = (erector?.scores ?? data.scores ?? {}) as Record<string, number | undefined>;
  const verdict = String(data.verdict ?? scores.verdict ?? erector?.verdict ?? "adjust");
  const realityScore = score100(scores.realityScore ?? erector?.realityScore);
  const confidencePct = Math.min(100, Math.max(0, realityScore || 72));

  const paths = data.paths ?? (erector?.paths as ValidationScreenData["paths"]);
  const pathCurrent = parsePath(paths?.current);
  const pathAdjusted = parsePath(paths?.adjusted);
  const pathAlt = parsePath(paths?.alternative);

  const recommended: PathKey =
    verdict === "adjust" ? "adjusted" : verdict === "pivot" ? "alternative" : "current";

  const verdictLabel =
    verdict === "proceed" ? "PROCEED"
    : verdict === "pivot" ? "PIVOT REQUIRED"
    : verdict === "blocked" ? "BLOCKED"
    : "PROCEED WITH ADJUSTMENTS";

  const verdictColor =
    verdict === "proceed" ? "text-emerald-600"
    : verdict === "pivot" || verdict === "blocked" ? "text-red-600"
    : "text-amber-600";

  const risks = useMemo(() => {
    const fromErector = erector?.risks as string[] | undefined;
    if (Array.isArray(fromErector) && fromErector.length) return fromErector;
    return [
      "Execution Risk — delivery capacity vs stated commitment.",
      "Distribution Risk — reach and channel fit need validation.",
      "Consistency Risk — weekly execution rhythm must hold.",
      "Market Risk — competitive pressure in target segment.",
    ];
  }, [erector]);

  const opportunities = useMemo(() => {
    const fromErector = erector?.opportunities as string[] | undefined;
    if (Array.isArray(fromErector) && fromErector.length) return fromErector;
    return ["Unmet Needs", "Weak Solutions", "Underserved Segments", "Better Angles"];
  }, [erector]);

  const realityCards = [
    { label: "Market Reality", score: score100(scores.marketScore ?? 78), tag: "Good", color: "text-blue-600" },
    { label: "Demand Signal", score: score100(scores.timingScore ?? 81), tag: "Strong", color: "text-emerald-600" },
    {
      label: "Competitor Pressure",
      score: score100(scores.competitionScore ?? 72),
      tag: "Moderate",
      color: "text-orange-600",
    },
    { label: "Feasibility", score: score100(scores.executionScore ?? 85), tag: "Strong", color: "text-purple-600" },
    { label: "Timing", score: score100(scores.timingScore ?? 74), tag: "Favorable", color: "text-amber-600" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
      <PageHeader
        title="Validation Results"
        subtitle="Reality check complete. Here's your direction and what to focus on."
        badge={
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            {completedLabel}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Download Report
            </button>
            <button
              type="button"
              disabled={launching || data.launchBlocked}
              onClick={onLaunch}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Rocket className="w-4 h-4" />
              {launching ? "Launching Blueprint…" : "Launch Blueprint"}
            </button>
          </>
        }
      />

      {launchError && (
        <pre className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-4 whitespace-pre-wrap">{launchError}</pre>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-1">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
          <p className="text-xs font-bold uppercase text-gray-500">Final Verdict</p>
          <p className={`mt-2 text-lg font-bold ${verdictColor}`}>{verdictLabel}</p>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {String(data.intelligence?.verdictReasoning ?? "Strong potential with clear opportunities. Adjust positioning for maximum impact.")}
          </p>
        </div>
        <StatCard
          label="Confidence Score"
          value={`${confidencePct}%`}
          sub="Composite reality /100"
          icon={
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center text-emerald-600 font-bold">
              {confidencePct}%
            </div>
          }
        />
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm">
          <Flag className="w-8 h-8 text-emerald-600 mb-2" />
          <p className="text-xs font-bold uppercase text-gray-500">Recommended Path</p>
          <p className="mt-2 text-lg font-bold text-gray-900">{PATH_LABELS[recommended]}</p>
          <span className="inline-block mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            Recommended
          </span>
          <p className="mt-3 text-sm text-gray-600">
            {String(pathAdjusted.description ?? pathAdjusted.summary ?? "Optimized path based on your validation scores.")}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">Reality Scorecard</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {realityCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{card.score}</p>
              <span className={`text-[10px] font-bold uppercase ${card.color}`}>{card.tag}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs font-bold uppercase text-gray-500 mb-3">Path Outcomes</p>
        <div className="grid lg:grid-cols-3 gap-4">
          {(["current", "adjusted", "alternative"] as PathKey[]).map((key) => {
            const path = key === "current" ? pathCurrent : key === "adjusted" ? pathAdjusted : pathAlt;
            const isRec = key === recommended;
            const selected = selectedPath === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectPath(key)}
                className={`text-left rounded-2xl border-2 bg-white p-5 shadow-sm transition-colors ${
                  selected ? "border-emerald-500 ring-2 ring-emerald-100" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {isRec && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 mb-2 inline-block">
                    Recommended
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {key === "adjusted" ? <Star className="w-4 h-4 text-amber-500" /> : <X className="w-4 h-4 text-gray-400" />}
                  <span className="font-bold text-sm">{PATH_LABELS[key]}</span>
                </div>
                <p className="text-sm text-gray-600">{String(path.description ?? path.summary ?? "—")}</p>
                <p className="mt-3 text-xs font-bold text-gray-500 uppercase">Success Potential</p>
                <p className="text-emerald-700 font-semibold">{String(path.growthPotential ?? path.successPotential ?? "—")}%</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase text-gray-500 mb-4">Risk Summary</p>
          <div className="space-y-3">
            {risks.slice(0, 4).map((risk, i) => (
              <div key={risk} className="rounded-xl border border-red-50 bg-red-50/50 p-3 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${i === 0 ? "bg-red-200 text-red-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {i === 0 ? "High" : "Medium"}
                  </span>
                  <p className="text-sm text-gray-800 mt-1">{risk}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase text-gray-500 mb-4">Opportunity Areas</p>
          <div className="grid grid-cols-2 gap-3">
            {opportunities.slice(0, 4).map((item) => (
              <div key={item} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-gray-800">
                <TrendingUp className="w-4 h-4 text-emerald-600 mb-1" />
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-6 flex gap-4">
        <Lightbulb className="w-8 h-8 text-amber-600 shrink-0" />
        <div>
          <p className="text-xs font-bold uppercase text-amber-800">Direction Insight</p>
          <p className="mt-2 text-sm text-gray-800 leading-relaxed">
            {String(
              erector?.directionInsight ??
                data.intelligence?.verdictReasoning ??
                "Narrow your focus to the recommended path. Validate assumptions with your first execution cycle.",
            )}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">Blueprint Readiness</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1"><Flag className="w-3 h-3" /> Chosen Direction</p>
            <p className="font-semibold mt-1">{PATH_LABELS[selectedPath]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1"><Target className="w-3 h-3" /> Target User</p>
            <p className="mt-1 text-gray-700">{String(erector?.targetCustomer ?? "—")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Success Definition</p>
            <p className="mt-1 text-gray-700">{String(erector?.desiredOutcome ?? "—")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1"><Shield className="w-3 h-3" /> Constraints</p>
            <p className="mt-1 text-gray-700">{String(erector?.timeframe ?? "—")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Priority Areas</p>
            <p className="mt-1 text-gray-700">MVP · Positioning · Acquisition · Retention</p>
          </div>
        </div>
      </section>

      <div className="rounded-xl bg-emerald-600 text-white px-6 py-4 text-center text-sm font-medium">
        Validation complete. You have a strong direction. Adjust, focus, and execute with consistency.
      </div>
    </div>
  );
}
