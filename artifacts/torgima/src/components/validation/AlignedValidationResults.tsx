import { useState } from "react";
import { Flag, Settings, Shuffle } from "lucide-react";
import type { ValidationScreenData } from "./ValidationScreen";
import { IntelligenceStatusBar } from "./IntelligenceStatusBar";
import { IndustryIntelligencePanel } from "./IndustryIntelligencePanel";
import { FeasibilityScoreCard } from "./FeasibilityScoreCard";
import { PathComparisonTable } from "./PathComparisonTable";
import type { PathKey } from "./PathPanels";
import { apiFetchEnvelope } from "@/lib/torgima-api";

const SCORE_LABELS: { key: string; label: string }[] = [
  { key: "marketScore", label: "Market" },
  { key: "executionScore", label: "Execution" },
  { key: "timingScore", label: "Timing" },
  { key: "competitionScore", label: "Competition" },
  { key: "scalabilityScore", label: "Scalability" },
  { key: "localEconomyScore", label: "Local economy" },
  { key: "resourceScore", label: "Resources" },
  { key: "blueprintDifficultyScore", label: "Blueprint difficulty" },
  { key: "riskScore", label: "Risk" },
  { key: "momentumPotential", label: "Momentum" },
  { key: "trustBuildingScore", label: "Trust building" },
];

function scoreBarColor(n: number): string {
  if (n >= 7) return "bg-green-500";
  if (n >= 5) return "bg-amber-500";
  return "bg-red-500";
}

function parsePath(raw: unknown) {
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

export function AlignedValidationResults({
  data,
  goalSummary,
  onPathSelected,
}: {
  data: ValidationScreenData;
  goalSummary?: { goal: string; purpose?: string; timeframe?: string };
  onPathSelected?: (path: PathKey) => void;
}) {
  const erector = data.intelligence?.["erector"] as Record<string, unknown> | undefined;
  const erectorScores = (erector?.scores ?? {}) as Record<string, number | undefined>;
  const [selectedPath, setSelectedPath] = useState<PathKey>("adjusted");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const validationId = data.erectorValidationId ?? data.validationId;
  const realityScore = Number(erectorScores.realityScore ?? 0);
  const verdict = String(data.verdict ?? erectorScores.verdict ?? "adjust");
  const tier = String(
    erectorScores.recommendedBlueprintLevel ?? erector?.recommendedBlueprintLevel ?? "starter",
  );
  const depthLabel =
    tier === "growth" ? "Growth Depth" : tier === "ultimate" ? "Full Depth" : "Starter Depth";

  const paths = data.paths ?? (erector?.paths as ValidationScreenData["paths"]);
  const pathCurrent = parsePath(paths?.current);
  const pathAdjusted = parsePath(paths?.adjusted);
  const pathAlt = parsePath(paths?.alternative);

  const executionScore = Number(erectorScores.executionScore ?? data.scores?.feasibility?.score ?? 5);

  async function handlePathSelection() {
    if (!validationId) return;
    setSubmitting(true);
    setError("");
    const envelope = await apiFetchEnvelope<{ selected_path?: string }>(
      `/api/v1/validation/${validationId}/select-path`,
      {
        method: "POST",
        body: JSON.stringify({ selectedPath }),
      },
    );
    setSubmitting(false);
    if (!envelope.ok) {
      setError(envelope.error?.message ?? "Path selection failed.");
      return;
    }
    onPathSelected?.(selectedPath);
  }

  const verdictBadge =
    verdict === "proceed"
      ? "bg-green-500 text-white"
      : verdict === "pivot"
        ? "bg-purple-500 text-white"
        : verdict === "blocked"
          ? "bg-red-500 text-white"
          : "bg-yellow-500 text-white";

  const defaultVerdictText: Record<string, string> = {
    proceed:
      "You can proceed. Your direction is validated. Demand, feasibility, and risk profile support proceeding with selected path.",
    adjust:
      "Proceed with adjustments. Modify positioning or scope before launch to improve success probability.",
    pivot: "A pivot is required before launch. Select the alternative path to address the core viability issue.",
    blocked: "Blueprint launch is blocked. Resolve the flagged requirements before proceeding.",
  };

  return (
    <div className="space-y-8">
      {goalSummary && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Refined goal</p>
          <p className="font-semibold text-gray-900 mt-1">{goalSummary.goal}</p>
          {goalSummary.timeframe && <p className="text-sm text-gray-500 mt-1">Timeframe: {goalSummary.timeframe}</p>}
        </div>
      )}

      <IntelligenceStatusBar progress={data.systemsProgress} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Reality scores</h3>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            {SCORE_LABELS.map(({ key, label }) => {
              const raw = Number(erectorScores[key] ?? 0);
              const display = Math.min(10, Math.max(0, raw));
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{label}</span>
                    <span className="font-bold text-gray-900">{display.toFixed(1)}/10</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreBarColor(display)}`}
                      style={{ width: `${(display / 10) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
          <p className="text-xs uppercase text-gray-500 font-semibold">Reality score</p>
          <p className="text-4xl font-bold text-gray-900">{realityScore.toFixed(1)}</p>
          <p className="text-xs uppercase text-gray-500 font-semibold">Verdict</p>
          <span className={`inline-block px-3 py-1 rounded text-sm font-semibold capitalize ${verdictBadge}`}>
            {verdict}
          </span>
          <p className="text-xs text-gray-500">Blueprint level: {tier}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Industry Intelligence</h2>
          <span className="text-xs text-gray-400 uppercase tracking-wide">{depthLabel}</span>
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <IndustryIntelligencePanel panel={data.industryPanel} tier={tier} erector={erector} />
          </div>
          <FeasibilityScoreCard
            score={executionScore * 10}
            verdict={verdict}
            tabsFeasibility={{
              timeframeReality: "See simulations",
              effortEstimate: String(
                (erector?.executionDifficulty as Record<string, unknown> | undefined)?.executionIntensityLevel ??
                  "moderate",
              ),
            }}
          />
        </div>
      </div>

      <PathComparisonTable
        paths={{
          current: pathCurrent,
          adjusted: pathAdjusted,
          alternative: pathAlt,
        }}
        tier={tier}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-base font-semibold text-gray-900">Strategic paths</h3>
          {(
            [
              { key: "current" as const, label: "Current Path", icon: Flag, path: pathCurrent },
              { key: "adjusted" as const, label: "Adjusted Path", icon: Settings, path: pathAdjusted },
              { key: "alternative" as const, label: "Alternative Path", icon: Shuffle, path: pathAlt },
            ] as const
          ).map(({ key, label, icon: Icon, path }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPath(key)}
              className={`w-full text-left border-2 rounded-lg p-4 transition-colors ${
                selectedPath === key ? "border-green-500 bg-green-50/40" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" />
                <span className="font-semibold">{label}</span>
              </div>
              <p className="text-sm text-gray-600">
                {String(path.description ?? path.summary ?? "Path details from validation.")}
              </p>
            </button>
          ))}
        </div>
        <div className="border border-gray-200 rounded-lg p-5 h-full">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">VERDICT</p>
          <div className={`inline-block px-4 py-2 rounded font-semibold text-sm mb-3 ${verdictBadge}`}>
            {verdict.toUpperCase()}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {String(data.intelligence?.verdictReasoning ?? defaultVerdictText[verdict] ?? defaultVerdictText.adjust)}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={!selectedPath || submitting || data.launchBlocked}
        onClick={() => void handlePathSelection()}
        className="w-full bg-gray-900 text-white py-4 rounded-lg font-medium text-base hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Selecting path…" : "Choose execution path →"}
      </button>
    </div>
  );
}
