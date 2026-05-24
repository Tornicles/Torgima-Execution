import { useState } from "react";

type BlockData = Record<string, string | string[] | undefined>;

function Block({
  title,
  source,
  data,
  defaultOpen = true,
  lowConfidence,
}: {
  title: string;
  source?: string;
  data: BlockData;
  defaultOpen?: boolean;
  lowConfidence?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <p className="font-semibold text-sm text-gray-900">{title}</p>
          {source && <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{source}</p>}
          {lowConfidence && (
            <p className="text-[10px] font-medium text-amber-700 mt-0.5">Low confidence — verify before launch</p>
          )}
        </div>
        <span className="text-gray-400 text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100">
          {Object.entries(data).map(([k, v]) => {
            if (k === "source" || !v) return null;
            return (
              <div key={k}>
                <p className="text-[10px] uppercase text-gray-400 font-medium">{k.replace(/([A-Z])/g, " $1")}</p>
                {Array.isArray(v) ?
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {v.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                : <p className="text-sm text-gray-800">{v}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type GoalPersonalization = {
  rawGoal: string;
  locationCountry: string;
  businessModel: string;
  commitmentLevel?: string;
  timeframe?: string;
};

function shortGoalLabel(rawGoal: string): string {
  const words = rawGoal.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 5) return rawGoal.trim();
  return `${words.slice(0, 5).join(" ")}...`;
}

export function IndustryIntelligencePanel({
  panel,
  tier,
  erector,
  goal,
}: {
  panel?: Record<string, unknown>;
  tier?: string | null;
  erector?: Record<string, unknown>;
  goal?: GoalPersonalization;
}) {
  const industryIntel = (erector?.industryIntelligence ?? erector?.industry_intelligence) as
    | Record<string, unknown>
    | undefined;
  const competitorAnalysis = (erector?.competitorAnalysis ?? erector?.competitor_analysis) as
    | Array<Record<string, unknown>>
    | undefined;
  const economyBriefing = (erector?.economyBriefing ?? erector?.economy_briefing) as Record<string, unknown> | undefined;

  const locationCountry = goal?.locationCountry ?? "your market";
  const businessModel = goal?.businessModel ?? "this category";
  const rawGoal = goal?.rawGoal ?? "";
  const shortGoal = rawGoal ? shortGoalLabel(rawGoal) : "your goal";
  const demandStrength = String(industryIntel?.saturationLevel ?? industryIntel?.trendDirection ?? "uneven");

  if (!panel && !erector) return null;
  const p = (panel ?? {
    industryOverview: industryIntel
      ? {
          industry: String(industryIntel.industryState ?? industryIntel.industry ?? businessModel),
          health: String(industryIntel.industryHealth ?? "—"),
          entryDifficulty: String(industryIntel.entryDifficulty ?? "Moderate"),
        }
      : undefined,
    demandIntelligence: industryIntel
      ? {
          direction: String(industryIntel.trendDirection ?? "—"),
          strength: String(industryIntel.saturationLevel ?? "—"),
          topDrivers: (industryIntel.innovationPatterns as string[]) ?? [],
        }
      : undefined,
    competitiveLandscape: {
      threatLevel: String(industryIntel?.competitionDensity ?? "Medium"),
      gapOpportunities:
        competitorAnalysis?.map((c) => String(c.strategicGapForUser ?? c.name ?? "")).filter(Boolean).slice(0, 2) ??
        [],
    },
    riskMap: industryIntel?.primaryRiskFactors
      ? [
          {
            title: String((industryIntel.primaryRiskFactors as Array<{ name?: string }>)?.[0]?.name ?? "Execution risk"),
            level: "medium",
            trigger: String(industryIntel.primaryRiskFactors ?? "Market shift"),
            prevention: "Validate assumptions with first paying customers.",
          },
        ]
      : [],
    verdictContext: {
      mightWork: `Demand for this type of solution in ${locationCountry} is ${demandStrength}. ${
        economyBriefing?.trustBuildingMechanism
          ? String(economyBriefing.trustBuildingMechanism)
          : String(economyBriefing?.briefingNarrative ?? "")
      }`.trim(),
      mightFail: `Without a clear proof-of-demand signal in the first 30 days, this goal risks stalling before traction is reached. ${
        ((industryIntel?.historicalFailurePatterns as string[]) ?? [])[0] ?? ""
      }`.trim(),
    },
  }) as {
    industryOverview?: BlockData;
    demandIntelligence?: BlockData;
    competitiveLandscape?: BlockData;
    executionReality?: BlockData;
    riskMap?: Array<{ title: string; level: string; trigger: string; prevention: string }>;
    strategicWindows?: BlockData;
    verdictContext?: BlockData;
  };

  const isLowConfidence = (block?: BlockData) => {
    if (!block) return false;
    const c = String(block.confidence ?? block.confidenceLevel ?? "").toLowerCase();
    return c === "low";
  };

  const levelColor = (level: string) =>
    level === "critical" ? "text-red-700 bg-red-50"
    : level === "high" ? "text-orange-700 bg-orange-50"
    : level === "medium" ? "text-amber-700 bg-amber-50"
    : "text-green-700 bg-green-50";

  const industryTitle = `Industry Overview — ${businessModel}`;
  const demandTitle = `Demand for ${shortGoal} in ${locationCountry}`;
  const competitiveTitle = `Competitive Landscape in ${locationCountry}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Industry Intelligence</h3>
        <span className="text-xs text-gray-500 capitalize">{tier ?? "starter"} depth</span>
      </div>
      {p.industryOverview && (
        <Block title={industryTitle} source="EIS" data={p.industryOverview} lowConfidence={isLowConfidence(p.industryOverview)} />
      )}
      {p.demandIntelligence && (
        <Block title={demandTitle} source="EIS" data={p.demandIntelligence} lowConfidence={isLowConfidence(p.demandIntelligence)} />
      )}
      {p.competitiveLandscape && (
        <Block
          title={competitiveTitle}
          source="EIS + SIS"
          data={p.competitiveLandscape}
          lowConfidence={isLowConfidence(p.competitiveLandscape)}
        />
      )}
      {p.executionReality && (
        <Block title="Execution Reality" source="SIS" data={p.executionReality} defaultOpen={tier !== "starter"} lowConfidence={isLowConfidence(p.executionReality)} />
      )}
      {p.riskMap && p.riskMap.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
          <p className="font-semibold text-sm">Risk Map — {shortGoal}</p>
          <p className="text-[10px] text-gray-400 uppercase">PIS + EIS</p>
          {p.riskMap.map((r) => (
            <div key={r.title} className={`rounded-lg p-3 text-sm ${levelColor(r.level)}`}>
              <p className="font-semibold">{r.title}</p>
              <p className="text-xs mt-1 opacity-90">Trigger: {r.trigger}</p>
              <p className="text-xs mt-0.5">Prevention: {r.prevention}</p>
            </div>
          ))}
        </div>
      )}
      {tier !== "starter" && p.strategicWindows && (
        <Block title="Strategic Windows" source="EIS" data={p.strategicWindows} defaultOpen={false} />
      )}
      {p.verdictContext && <Block title="Verdict Context" source="VerdictEngine" data={p.verdictContext} />}
    </div>
  );
}
