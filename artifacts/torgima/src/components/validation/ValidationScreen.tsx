import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";
import { IndustryIntelligencePanel } from "./IndustryIntelligencePanel";
import { ValidationTabGroup } from "./ValidationTabGroup";
import { PathPanels, type PathKey } from "./PathPanels";
import { VerdictPanel } from "./VerdictPanel";
import { ReadinessIndicator } from "./ReadinessIndicator";

export interface ValidationScreenData {
  validationId?: string;
  blueprintId?: string;
  verdict?: string;
  readiness?: string;
  launchBlocked?: boolean;
  industryPanel?: Record<string, unknown>;
  tabs?: Record<string, Record<string, unknown>>;
  paths?: Partial<Record<PathKey, Record<string, unknown>>>;
  intelligence?: Record<string, unknown> & { verdictReasoning?: string };
  scores?: Record<string, { score?: number }>;
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

      <IndustryIntelligencePanel panel={data.industryPanel} tier={tier} />

      <ValidationTabGroup tabs={data.tabs} tier={tier} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PathPanels
            paths={data.paths as Parameters<typeof PathPanels>[0]["paths"]}
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
