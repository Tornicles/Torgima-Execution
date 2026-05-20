import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import { routeBhudhiRequest } from "../../../bhudhi/TriggerRouter.js";
import type {
  CISContext,
  CompetitorInsight,
  DemandSignal,
  EISIntelligence,
  IndustryClassification,
  IndustryIntelligencePanel,
  StrategicWindow,
  TrendSignal,
} from "./validation-intelligence-types.js";

export async function fetchEISIntelligence(params: {
  goal: string;
  purpose?: string;
  timeframe?: string;
  classification: IndustryClassification;
  cis: CISContext;
  userId: string;
  blueprintId: string;
  aiEnabled: boolean;
}): Promise<EISIntelligence> {
  const { checkEISAccess, recordEISCall } = await import("../EISRateLimitService.js");

  if (params.aiEnabled) {
    const access = await checkEISAccess({
      userId: params.userId,
      blueprintId: params.blueprintId,
      industry: params.classification.industry,
      niche: params.classification.niche,
    });

    if (access.mode === "cached" || access.mode === "budget_exceeded") {
      await recordEISCall({
        userId: params.userId,
        blueprintId: params.blueprintId,
        industry: params.classification.industry,
        niche: params.classification.niche,
        payload: access.payload,
        cacheHit: true,
        lowConfidence: access.lowConfidence,
      });
      return access.payload;
    }
  }

  let result: EISIntelligence;
  if (params.aiEnabled) {
    try {
      const enriched = await fetchEISViaBhudhi(params);
      if (enriched) {
        result = enriched;
        await recordEISCall({
          userId: params.userId,
          blueprintId: params.blueprintId,
          industry: params.classification.industry,
          niche: params.classification.niche,
          payload: result,
          tokensUsed: 1200,
          estimatedCostUsd: 0.03,
        });
        return result;
      }
    } catch {
      /* fallback */
    }
  }
  result = buildDeterministicEIS(params);
  if (params.aiEnabled) {
    await recordEISCall({
      userId: params.userId,
      blueprintId: params.blueprintId,
      industry: params.classification.industry,
      niche: params.classification.niche,
      payload: result,
      cacheHit: false,
      lowConfidence: true,
      estimatedCostUsd: 0,
    });
  }
  return result;
}

async function fetchEISViaBhudhi(params: {
  goal: string;
  purpose?: string;
  timeframe?: string;
  classification: IndustryClassification;
  cis: CISContext;
  userId: string;
  blueprintId: string;
}): Promise<EISIntelligence | null> {
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const result = await routeBhudhiRequest({
    sourceEngine: "validation_eis",
    triggerType: "EIS_INDUSTRY_RESEARCH",
    userId: params.userId,
    blueprintId: params.blueprintId,
    stateVersion: bp?.state_version ?? 0,
    idempotencyKey: `eis:${params.blueprintId}:${Date.now()}`,
    facts: {
      rawGoal: params.goal,
      purpose: params.purpose ?? "",
      domain: params.classification.domain,
      timeframe: params.timeframe ?? "",
      industry: params.classification.industry,
      niche: params.classification.niche,
      currentContext: params.cis.executionContext,
    },
  });

  if (!result.ok || !result.output?.data) return null;
  const d = result.output.data as Record<string, unknown>;
  const momentum = String(d["marketMomentum"] ?? "emerging");
  const demandConf = String(d["demandConfidence"] ?? "medium");

  const demand: DemandSignal = {
    direction:
      momentum === "declining" ? "declining"
      : momentum === "growing" || momentum === "emerging" ? "rising"
      : momentum === "oversaturated" ? "stable"
      : "volatile",
    strength:
      demandConf === "high" ? "strong"
      : demandConf === "low" ? "weak"
      : "moderate",
    evidence: [String(d["trendExplanation"] ?? "Bhudhi industry framing")],
    demand_type: momentum === "emerging" ? "emerging" : momentum === "growing" ? "proven" : "speculative",
  };

  const whiteSpace = (d["whiteSpace"] ?? {}) as Record<string, unknown>;
  const positioning = (d["positioning"] ?? {}) as Record<string, unknown>;
  const timing = (d["timingAnalysis"] ?? {}) as Record<string, unknown>;
  const similar = (d["similarConcepts"] as Array<Record<string, string>>) ?? [];

  const competitors: CompetitorInsight[] = similar.slice(0, 4).map((s, i) => ({
    tier: (i === 0 ? "dominant" : i < 3 ? "established" : "emerging") as CompetitorInsight["tier"],
    name: s.name ?? `Reference ${i + 1}`,
    differentiators: [s.differentiationInsight ?? s.lesson ?? "Differentiation required"],
    gap_opportunities: (whiteSpace["executionGaps"] as string[])?.slice(0, 2) ?? ["Underserved segment"],
    threat_level: momentum === "oversaturated" ? "high" : "medium",
  }));

  const windows: StrategicWindow[] = [
    {
      label: "Entry window",
      timing: String(timing["urgency"] ?? "moderate"),
      leverage: String(timing["opportunity"] ?? whiteSpace["opportunityPath"] ?? "Validate demand before scaling"),
      closesWhen: String(timing["risk"] ?? "Saturation increases without differentiation"),
    },
  ];

  return {
    industry: params.classification.industry,
    niche: params.classification.niche,
    domain: params.classification.domain,
    macro_trends: [
      { label: "Market momentum", direction: mapMomentumDir(momentum), summary: String(d["trendExplanation"] ?? "") },
    ],
    micro_trends: [
      {
        label: params.classification.niche,
        direction: "stable",
        summary: String(positioning["differentiationPath"] ?? "Niche execution patterns apply"),
      },
    ],
    demand_signal: demand,
    saturation_level: momentum === "oversaturated" ? "critical" : momentum === "growing" ? "medium" : "low",
    opportunity_windows: windows,
    competitor_landscape: competitors.length ? competitors : buildDefaultCompetitors(params.classification.industry),
    platform_context: [
      {
        platform: "Primary channel",
        condition: momentum === "behavior_shifting" ? "shifting" : "stable",
        implication: String(d["executionImplication"] ?? "Channel selection affects early traction"),
      },
    ],
    strategic_windows: windows,
    last_updated: new Date().toISOString(),
    confidence_score: result.fallbackUsed ? 55 : 78,
    source: result.fallbackUsed ? "EIS+fallback" : "EIS",
  };
}

function mapMomentumDir(m: string): TrendSignal["direction"] {
  if (m === "declining") return "down";
  if (m === "growing" || m === "emerging") return "up";
  if (m === "behavior_shifting") return "volatile";
  return "stable";
}

function buildDeterministicEIS(params: {
  goal: string;
  classification: IndustryClassification;
}): EISIntelligence {
  const text = params.goal.toLowerCase();
  const money = /\b(revenue|mrr|money|income|profit)\b/.test(text);
  const demand: DemandSignal = {
    direction: money ? "rising" : "stable",
    strength: money ? "moderate" : "weak",
    evidence: [
      `Goal framed in ${params.classification.industry} — ${params.classification.niche}`,
      "Deterministic EIS snapshot (enable AI for deeper industry synthesis)",
    ],
    demand_type: money ? "emerging" : "speculative",
  };

  return {
    industry: params.classification.industry,
    niche: params.classification.niche,
    domain: params.classification.domain,
    macro_trends: [{ label: "Industry cycle", direction: "stable", summary: `${params.classification.industry} remains active for focused execution` }],
    micro_trends: [{ label: params.classification.niche, direction: "up", summary: "Niche operators win with proof-of-demand before scale" }],
    demand_signal: demand,
    saturation_level: /\b(crowded|saturated|competitive)\b/i.test(text) ? "high" : "medium",
    opportunity_windows: [
      {
        label: "Validation window",
        timing: "now",
        leverage: "Test demand before committing full execution capacity",
      },
    ],
    competitor_landscape: buildDefaultCompetitors(params.classification.industry),
    platform_context: [{ platform: "Execution channel", condition: "neutral", implication: "Choose one primary channel for first 30 days" }],
    strategic_windows: [{ label: "Proof phase", timing: "immediate", leverage: "Ship smallest proof that validates demand" }],
    last_updated: new Date().toISOString(),
    confidence_score: 62,
    source: "EIS+fallback",
  };
}

function buildDefaultCompetitors(industry: string): CompetitorInsight[] {
  return [
    {
      tier: "dominant",
      name: `Established ${industry} leaders`,
      differentiators: ["Brand trust", "Distribution scale"],
      gap_opportunities: ["Underserved niche positioning", "Faster feedback loops"],
      threat_level: "medium",
    },
    {
      tier: "emerging",
      name: "New entrants",
      differentiators: ["Speed", "Narrow focus"],
      gap_opportunities: ["Specific audience pain points"],
      threat_level: "low",
    },
  ];
}

export function buildIndustryIntelligencePanel(
  eis: EISIntelligence,
  goal: string,
): IndustryIntelligencePanel {
  const health =
    eis.demand_signal.direction === "rising" ? "Growing"
    : eis.demand_signal.direction === "declining" ? "Declining"
    : eis.saturation_level === "critical" ? "Volatile"
    : "Stable";

  return {
    industryOverview: {
      industry: eis.industry,
      category: eis.niche,
      health,
      marketSize: eis.saturation_level === "critical" ? "Large but crowded" : "Medium",
      entryDifficulty:
        eis.saturation_level === "critical" ? "Highly Competitive"
        : eis.saturation_level === "high" ? "Hard"
        : "Moderate",
      timeToFirstResult: "4–12 weeks for measurable signal with focused execution",
      source: "EIS",
    },
    demandIntelligence: {
      direction: eis.demand_signal.direction,
      strength: eis.demand_signal.strength,
      demandType: eis.demand_signal.demand_type,
      realDemandSignals: [
        "Paid conversions or signed commitments",
        "Repeat engagement from target segment",
        "Inbound requests matching your offer",
      ],
      fakeDemandSignals: ["Vanity metrics without conversion", "Audience growth without buyer intent", "Praise without payment"],
      topDrivers: eis.demand_signal.evidence,
      source: "EIS",
    },
    competitiveLandscape: {
      dominantPlayers: eis.competitor_landscape.filter((c) => c.tier === "dominant").map((c) => c.name),
      differentiators: eis.competitor_landscape.flatMap((c) => c.differentiators).slice(0, 4),
      failurePatterns: ["Generic positioning", "Scaling before proof", "Ignoring channel-market fit"],
      gapOpportunities: eis.competitor_landscape.flatMap((c) => c.gap_opportunities).slice(0, 4),
      threatLevel: eis.competitor_landscape.some((c) => c.threat_level === "high") ? "High" : "Medium",
      source: "EIS + SIS",
    },
    executionReality: {
      successRequires: [
        "Clear measurable outcome tied to the goal",
        "Weekly proof-of-progress rituals",
        "Demand validation before delivery scale",
      ],
      skills: ["Execution discipline", "Offer clarity", "Feedback interpretation"],
      resources: ["Time blocks", "Basic tooling", "Audience or customer access"],
      bottlenecks: ["Unclear positioning", "No demand proof", "Scope creep"],
      realisticPace: "1–2 validated milestones per month at starter commitment",
      source: "SIS",
    },
    riskMap: buildPanelRisks(eis, goal),
    strategicWindows: {
      timing: eis.strategic_windows[0]?.timing ?? "moderate",
      platformConditions: eis.platform_context.map((p) => `${p.platform}: ${p.condition}`),
      leverageTrends: eis.macro_trends.map((t) => t.summary).slice(0, 2),
      closingWindows: eis.opportunity_windows.map((w) => w.closesWhen).filter(Boolean) as string[],
      source: "EIS",
    },
    verdictContext: {
      mightWork: `Demand is ${eis.demand_signal.direction} with ${eis.demand_signal.strength} strength in ${eis.industry}`,
      mightFail: eis.saturation_level === "critical" ? "Crowded market without differentiation" : "Weak demand proof before scaling",
      mustBeTrue: ["Measurable outcome defined", "Weekly execution proof", "Demand signal before expansion"],
      source: "PIS + VerdictEngine",
    },
  };
}

function buildPanelRisks(
  eis: EISIntelligence,
  goal: string,
): IndustryIntelligencePanel["riskMap"] {
  const risks: IndustryIntelligencePanel["riskMap"] = [];
  if (eis.demand_signal.direction === "declining") {
    risks.push({
      title: "Declining demand",
      level: "critical",
      trigger: "Market interest shrinking for this angle",
      prevention: "Pivot offer or audience segment",
      recovery: "Run demand proof sprint on adjacent niche",
    });
  }
  if (eis.saturation_level === "critical" || eis.saturation_level === "high") {
    risks.push({
      title: "Competitive saturation",
      level: "high",
      trigger: "Undifferentiated entry into crowded space",
      prevention: "Narrow positioning and unique proof",
      recovery: "Reposition with gap opportunity focus",
    });
  }
  if (goal.length < 30) {
    risks.push({
      title: "Goal ambiguity",
      level: "medium",
      trigger: "Execution scope unclear",
      prevention: "Add measurable outcome and timeframe",
      recovery: "Refine goal via IIS before launch",
    });
  }
  if (!risks.length) {
    risks.push({
      title: "Execution drift",
      level: "medium",
      trigger: "Inconsistent weekly proof",
      prevention: "Fixed weekly review cadence",
      recovery: "Reduce scope to one proof milestone",
    });
  }
  return risks.slice(0, 5);
}
