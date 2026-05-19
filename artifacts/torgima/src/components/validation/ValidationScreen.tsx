import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { IndustryIntelligencePanel } from "./IndustryIntelligencePanel";
import { ValidationTabGroup } from "./ValidationTabGroup";
import { PathPanels, type PathKey, type PathView } from "./PathPanels";
import { VerdictPanel } from "./VerdictPanel";
import { ReadinessIndicator } from "./ReadinessIndicator";
import { IntelligenceStatusBar } from "./IntelligenceStatusBar";
import { PathComparisonTable } from "./PathComparisonTable";
import { FeasibilityScoreCard } from "./FeasibilityScoreCard";
import { ScenarioSimulator } from "./ScenarioSimulator";

export interface ValidationScreenData {
  validationId?: string;
  validationContractId?: string;
  erectorValidationId?: string;
  blueprintId?: string;
  verdict?: string;
  readiness?: string;
  launchBlocked?: boolean;
  industryPanel?: Record<string, unknown>;
  tabs?: Record<string, Record<string, unknown>>;
  paths?: Partial<Record<PathKey, Record<string, unknown>>>;
  intelligence?: Record<string, unknown> & { verdictReasoning?: string };
  scores?: Record<string, { score?: number; verdict?: string }>;
  systemsProgress?: Record<string, "pending" | "running" | "complete">;
}

export function ValidationScreen({
  data,
  tier,
  selectedPath,
  onSelectPath,
  onLaunch,
  launching,
  goalSummary,
}: {
  data: ValidationScreenData;
  tier?: TierId | null;
  selectedPath: PathKey;
  onSelectPath: (p: PathKey) => void;
  onLaunch?: () => void;
  launching?: boolean;
  goalSummary?: { goal: string; purpose?: string; timeframe?: string };
}) {
  const reasoning =
    data.intelligence?.verdictReasoning ??
    (typeof data.intelligence === "object" && data.intelligence !== null ?
      String((data.intelligence as { verdictReasoning?: string }).verdictReasoning ?? "")
    : "");

  const paths = data.paths as Partial<Record<PathKey, PathView>> | undefined;
  const tabsFeasibility = data.tabs?.feasibility as Record<string, string | string[]> | undefined;

  return (
    <div className="space-y-6">
      {goalSummary && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Refined goal</p>
            <p className="font-semibold text-gray-900">{goalSummary.goal}</p>
            {goalSummary.timeframe && <p className="text-sm text-gray-500 mt-1">Timeframe: {goalSummary.timeframe}</p>}
          </div>
          <ReadinessIndicator readiness={data.readiness} />
        </div>
      )}

      <IntelligenceStatusBar progress={data.systemsProgress} />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <IndustryIntelligencePanel panel={data.industryPanel} tier={tier} />
        </div>
        <FeasibilityScoreCard
          score={data.scores?.feasibility?.score}
          verdict={data.scores?.feasibility?.verdict}
          tabsFeasibility={tabsFeasibility}
        />
      </div>

      <ValidationTabGroup tabs={data.tabs} tier={tier} />

      <PathComparisonTable paths={paths} tier={tier} />

      <ScenarioSimulator alternativePath={paths?.alternative} tier={tier} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PathPanels
            paths={paths}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
            tier={tier}
            verdict={data.verdict}
          />
        </div>
        <VerdictPanel
          verdict={data.verdict}
          reasoning={reasoning}
          launchBlocked={data.launchBlocked}
          onLaunch={onLaunch}
          launching={launching}
        />
      </div>
    </div>
  );
}
