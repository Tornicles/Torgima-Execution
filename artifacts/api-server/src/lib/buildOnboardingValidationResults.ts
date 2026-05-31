import type { validations } from "@workspace/db";

import {

  competitorsFromValidationRow,

  intelligenceFromRow,

  pathsFromValidationRow,

  userGoalFromRow,

  userPurposeFromRow,

} from "./mapValidationIntel.js";

import {

  enrichedFromValidationRow,

  mapCompetitorsForApi,

  mapOpportunitiesForApi,

} from "./enrichedValidationIntel.js";

import { buildErectorIntelligenceExtensions } from "../engines/erector/ErectorIntelligenceExtensions.js";



type ValidationRow = typeof validations.$inferSelect;



function scorePercent(row: ValidationRow): number {

  const intel = intelligenceFromRow(row);

  const r =

    intel.realityScore != null

      ? Number(intel.realityScore)

      : intel.reality_score != null

        ? Number(intel.reality_score)

        : row.reality_score != null

          ? Number(row.reality_score)

          : null;

  if (r != null && Number.isFinite(r)) {

    return Math.min(100, Math.max(0, Math.round(r <= 10 ? r * 10 : r)));

  }

  return 58;

}



function verdictFromRow(row: ValidationRow, score: number): string {

  const intel = intelligenceFromRow(row);

  const v = String(intel.verdict ?? row.verdict ?? "").toUpperCase();

  if (v === "PROCEED" || v === "GO") return "PROCEED";

  if (v === "PIVOT") return "PIVOT";

  if (v === "STOP" || v === "BLOCKED") return "STOP";

  if (score >= 75) return "PROCEED";

  if (score >= 50) return "ADJUST";

  return "PIVOT";

}



function verdictLabel(verdict: string): string {

  if (verdict === "PROCEED") return "Strong Foundation";

  if (verdict === "ADJUST") return "Promising with Adjustments";

  if (verdict === "PIVOT") return "High Risk";

  return "Needs Work";

}



function pathBlock(

  key: "adjusted" | "current" | "alternative",

  paths: Record<string, unknown>,

  intel: Record<string, unknown>,

  recommended: boolean,

) {

  const labels = {

    adjusted: "Adjusted Path (Best Fit)",

    current: "Current Path (As Is)",

    alternative: "Alternative Path (Pivot)",

  };

  const defaults = {

    adjusted: {

      description: "Modify scope before blueprint launch.",

      successPotential: "Moderate",

      estimatedOutcome: "Strong growth potential",

      timeToTraction: "—",

    },

    current: {

      description: "Proceed with current assumptions.",

      successPotential: "Moderate",

      estimatedOutcome: "Strong growth potential",

      timeToTraction: "—",

    },

    alternative: {

      description: "Pivot the first market or model.",

      successPotential: "Moderate",

      estimatedOutcome: "High growth potential",

      timeToTraction: "—",

    },

  };

  const intelPaths = (intel.paths as Record<string, Record<string, unknown>> | undefined) ?? {};

  const raw = (paths[key] ?? intelPaths[key] ?? {}) as Record<string, unknown>;

  const def = defaults[key];

  return {

    label: labels[key],

    description: String(raw.description ?? def.description),

    successPotential: String(raw.successPotential ?? raw.success_potential ?? def.successPotential),

    estimatedOutcome: String(raw.estimatedOutcome ?? raw.estimated_outcome ?? def.estimatedOutcome),

    timeToTraction: String(raw.timeToTraction ?? raw.time_to_traction ?? def.timeToTraction),

    recommended,

  };

}



export function buildOnboardingValidationResultsPayload(row: ValidationRow) {

  const intel = intelligenceFromRow(row);

  const realityScore = scorePercent(row);

  const verdict = verdictFromRow(row, realityScore);

  const paths = pathsFromValidationRow(row);

  const enriched = enrichedFromValidationRow(row);

  const competitors = mapCompetitorsForApi(enriched.competitors);

  const opportunities = mapOpportunitiesForApi(enriched.opportunities);

  const economicContext = enriched.economicContext;

  const goal = userGoalFromRow(row);
  const purpose = userPurposeFromRow(row);
  const intelligenceExtensions = buildErectorIntelligenceExtensions({
    goal,
    purpose,
    location: row.location_country ?? undefined,
    domain: row.domain ?? undefined,
    marketScore: realityScore,
  });

  return {

    validationId: row.id,

    realityScore,

    verdict,

    verdictLabel: verdictLabel(verdict),

    location: row.location_country ?? economicContext.country,

    industry: row.domain,

    atAGlance: {

      problemExists: intel.problemExists ?? true,

      marketDemand: intel.marketDemand ?? "Good",

      competitionLevel: intel.competitionLevel ?? "Moderate",

      feasibility: intel.feasibility ?? "Moderate",

      timing: intel.timing ?? "Moderate",

      executionFit: intel.executionFit ?? "Moderate",

      executionReadiness: intel.executionReadiness ?? "Moderate",

    },

    trendPosition: intel.trendPosition ?? "Stable Growth",

    growthRate: intel.growthRate ?? "+14% YoY",

    trendData: intel.trendData ?? [

      { year: 2023, value: 35 },

      { year: 2024, value: 48 },

      { year: 2025, value: 62 },

      { year: 2026, value: 75 },

      { year: 2027, value: 85 },

    ],

    competitors,

    economicContext,

    pros: (intel.pros ?? intel.advantages ?? row.industry_pros ?? []) as string[],

    cons: (intel.cons ?? intel.disadvantages ?? row.industry_cons ?? []) as string[],

    opportunities,

    paths: {

      adjusted: pathBlock("adjusted", paths, intel, true),

      current: pathBlock("current", paths, intel, false),

      alternative: pathBlock("alternative", paths, intel, false),

    },

    risks: intel.risks ?? [

      { title: "Execution Risk", description: "Capacity and focus may limit delivery speed.", severity: "Medium" },

      { title: "Market Risk", description: "Competitive response could compress margins.", severity: "Low" },

    ],

    milestones: intel.milestones ?? intel.successPlan ?? [

      { number: 1, title: "Define Niche & Offer", timeframe: "Week 1-2" },

      { number: 2, title: "Build Core Service & Systems", timeframe: "Week 3-6" },

      { number: 3, title: "Get First 5 Paying Clients", timeframe: "Month 2-3" },

      { number: 4, title: "Build Case Studies & Referrals", timeframe: "Month 4-6" },

      { number: 5, title: "Scale & Automate Operations", timeframe: "Month 7-12" },

    ],

    selectedPath: row.selected_path ?? "adjusted",

    goal,

    purpose,

    blueprintId: row.blueprint_id,

    intelligenceExtensions,

    validationStages: intelligenceExtensions.validationStages,

    executionReadiness: intelligenceExtensions.executionReadiness,

  };

}



export function validationProgressFromStatus(status: string): number {

  const s = status.toLowerCase();

  if (s === "complete" || s === "completed" || s === "validated" || s === "finalized") {

    return 100;

  }

  if (s === "running" || s === "queued" || s === "in_progress") return 45;

  return 0;

}

