import {
  db,
  validations,
  validationAtAGlance,
  validationBhudhiResearchLog,
  validationCompetitors,
  validationMarketTrends,
  validationOpportunities,
  validationPaths,
  validationProsCons,
  validationRisks,
  validationRuns,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { enrichedFromValidationRow } from "../../lib/enrichedValidationIntel.js";
import { pathsFromValidationRow } from "../../lib/mapValidationIntel.js";

type ValidationRow = typeof validations.$inferSelect;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function demandFromScore(score: number | null | undefined): string {
  if (score == null) return "unclear";
  if (score >= 70) return "good";
  if (score >= 45) return "moderate";
  return "weak";
}

function competitionFromScore(score: number | null | undefined): string {
  if (score == null) return "moderate";
  if (score >= 75) return "saturated";
  if (score >= 55) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

function fitFromScore(score: number | null | undefined): string {
  if (score == null) return "moderate";
  if (score >= 65) return "good";
  if (score >= 40) return "moderate";
  return "weak";
}

function timingFromScore(score: number | null | undefined): string {
  if (score == null) return "neutral";
  if (score >= 65) return "favorable";
  if (score >= 40) return "neutral";
  return "unfavorable";
}

function feasibilityFromScore(score: number | null | undefined): string {
  return fitFromScore(score);
}

/** Populate structured validation panel tables from a completed `validations` row. */
export async function syncValidationRunPanelsFromLegacyRow(
  validationRunId: string,
  row: ValidationRow,
): Promise<void> {
  const enriched = enrichedFromValidationRow(row);
  const paths = pathsFromValidationRow(row);
  const market = asRecord(row.market_analysis);
  const timing = asRecord(row.timing_analysis);
  const erector = asRecord(row.erector_payload);

  await db.delete(validationAtAGlance).where(eq(validationAtAGlance.validation_run_id, validationRunId));
  await db.delete(validationMarketTrends).where(eq(validationMarketTrends.validation_run_id, validationRunId));
  await db.delete(validationCompetitors).where(eq(validationCompetitors.validation_run_id, validationRunId));
  await db.delete(validationProsCons).where(eq(validationProsCons.validation_run_id, validationRunId));
  await db.delete(validationOpportunities).where(eq(validationOpportunities.validation_run_id, validationRunId));
  await db.delete(validationRisks).where(eq(validationRisks.validation_run_id, validationRunId));
  await db.delete(validationPaths).where(eq(validationPaths.validation_run_id, validationRunId));

  const reality = row.reality_score != null ? Math.round(Number(row.reality_score)) : null;
  const problemSummary = str(
    asRecord(row.customer_pain_analysis)?.summary ??
      asRecord(row.purpose_decomposition)?.problemStatement,
    "Pain and problem signals were evaluated against your stated goal.",
  );

  await db.insert(validationAtAGlance).values({
    validation_run_id: validationRunId,
    problem_exists: reality != null && reality >= 50 ? "yes" : reality != null && reality < 35 ? "no" : "unclear",
    problem_exists_summary: problemSummary,
    market_demand: demandFromScore(row.market_score),
    market_demand_summary: str(market?.summary, "Market demand was assessed from industry and search signals."),
    competition_level: competitionFromScore(row.competition_score),
    competition_summary: str(
      asRecord(row.competitor_analysis)?.summary,
      "Competitive landscape reviewed using live market research.",
    ),
    execution_fit: fitFromScore(row.execution_score),
    execution_fit_summary: str(
      asRecord(row.execution_difficulty)?.summary,
      "Execution fit reflects resources, timeframe, and commitment.",
    ),
    feasibility: feasibilityFromScore(row.feasibility_score ?? row.blueprint_difficulty_score),
    feasibility_summary: str(
      asRecord(row.execution_difficulty)?.feasibilityNote,
      "Feasibility combines budget, skills, and operational complexity.",
    ),
    timing: timingFromScore(row.timing_score),
    timing_summary: str(timing?.summary, "Timing considers market momentum and economic conditions."),
  });

  const growthRaw =
    market?.growthRate != null
      ? Number(market.growthRate)
      : market?.growth_rate != null
        ? Number(market.growth_rate)
        : row.momentum_potential != null
          ? Number(row.momentum_potential)
          : 12;

  await db.insert(validationMarketTrends).values({
    validation_run_id: validationRunId,
    trend_summary: str(
      market?.trendSummary ?? market?.trend_summary,
      `Market for this idea shows ${demandFromScore(row.market_score)} demand signals.`,
    ),
    trend_position: str(market?.trend ?? market?.trend_position, "Early Growth"),
    growth_rate: `+${Math.round(growthRaw)}% YoY`,
    growth_rate_raw: growthRaw,
    chart_data: asArray(market?.chart_data ?? market?.chartData).length
      ? asArray(market?.chart_data ?? market?.chartData)
      : [
          { year: 2022, value: Math.max(10, growthRaw - 8) },
          { year: 2023, value: Math.max(15, growthRaw - 4) },
          { year: 2024, value: Math.max(20, growthRaw) },
          { year: 2025, value: Math.max(25, growthRaw + 4) },
          { year: 2026, value: Math.max(30, growthRaw + 8) },
        ],
    sources: enriched.economicContext
      ? [{ title: "Economic context", snippet: enriched.economicContext.economicSummary }]
      : [],
    bhudhi_confidence: row.intelligence_payload ? "medium" : "low",
    researched_at: new Date(),
  });

  const competitors = enriched.competitors.slice(0, 3);
  for (let i = 0; i < competitors.length; i++) {
    const c = competitors[i]!;
    const shareNum = parseFloat(String(c.marketShare).replace(/[^0-9.]/g, "")) || 10 + i * 5;
    await db.insert(validationCompetitors).values({
      validation_run_id: validationRunId,
      rank: i + 1,
      name: c.name,
      description: c.description || c.tagline,
      website: "",
      market_share_pct: shareNum,
      market_share_label: c.marketShare || `${shareNum}%`,
      strengths: c.strengths,
      weaknesses: c.weaknesses,
      relevance_summary: c.whereYourIdeaFits,
      differentiation_hint: c.whereYourIdeaFits,
      researched_at: new Date(),
    });
  }

  let sort = 0;
  for (const pro of asArray(row.industry_pros).slice(0, 6)) {
    const text =
      typeof pro === "string" ? pro : str(asRecord(pro)?.description ?? asRecord(pro)?.name, "Advantage");
    await db.insert(validationProsCons).values({
      validation_run_id: validationRunId,
      type: "pro",
      text,
      weight: "medium",
      explanation: "Identified from industry and archetype analysis.",
      sort_order: sort++,
    });
  }
  for (const con of asArray(row.industry_cons).slice(0, 6)) {
    const text =
      typeof con === "string" ? con : str(asRecord(con)?.description ?? asRecord(con)?.name, "Risk factor");
    await db.insert(validationProsCons).values({
      validation_run_id: validationRunId,
      type: "con",
      text,
      weight: "medium",
      explanation: "Identified from industry and archetype analysis.",
      sort_order: sort++,
    });
  }

  for (const [i, opp] of enriched.opportunities.slice(0, 8).entries()) {
    await db.insert(validationOpportunities).values({
      validation_run_id: validationRunId,
      title: opp.title,
      description: opp.summary,
      impact: opp.impact.toLowerCase() as "high" | "medium" | "low",
      how_to_capture: opp.marketSignal,
      relevant_path: "all",
      sort_order: i,
    });
  }

  const risks = asArray(row.potential_risks);
  for (const [i, r] of risks.slice(0, 8).entries()) {
    const rec = asRecord(r);
    const severity = str(rec?.severity, "medium").toLowerCase();
    await db.insert(validationRisks).values({
      validation_run_id: validationRunId,
      risk_type: str(rec?.name ?? rec?.type, "Execution Risk"),
      description: str(rec?.description, "Risk identified during validation."),
      severity: ["critical", "high", "medium", "low"].includes(severity)
        ? severity
        : "medium",
      mitigation: str(rec?.mitigation, "Address in first execution phase."),
      blocks_launch: severity === "critical",
      sort_order: i,
    });
  }

  const pathTypes = ["current", "adjusted", "alternative"] as const;
  for (const pathType of pathTypes) {
    const pathRaw = paths[pathType];
    const path = asRecord(pathRaw);
    if (!path) continue;
    const planSk = asRecord(path.planSkeleton);
    const milestones = asArray(path.milestones ?? path.firstWeekPlan ?? planSk?.plans).map(
      (m, idx) => {
        const mr = asRecord(m);
        return {
          step: idx + 1,
          title: str(mr?.title ?? mr?.name, `Milestone ${idx + 1}`),
          timeframe: str(mr?.timeframe ?? mr?.timing, "Week 1-2"),
          description: str(mr?.description, ""),
        };
      },
    );
    if (milestones.length === 0) {
      milestones.push(
        { step: 1, title: "Validate demand", timeframe: "Week 1-2", description: "Prove real demand." },
        { step: 2, title: "Ship first offer", timeframe: "Week 3-4", description: "Deliver minimum viable offer." },
        { step: 3, title: "Measure traction", timeframe: "Month 2", description: "Track completion and revenue signals." },
      );
    }
    await db.insert(validationPaths).values({
      validation_run_id: validationRunId,
      path_type: pathType,
      label: str(path.label, `${pathType} path`),
      is_recommended: pathType === "adjusted" || path.recommended === true,
      description: str(path.summary ?? path.description, pathType),
      tagline: str(path.tagline, ""),
      success_potential: str(path.successPotential ?? path.success_potential, "medium"),
      estimated_outcome: str(path.estimatedOutcome ?? path.estimated_outcome, "Steady progress"),
      time_to_traction: str(path.timeToTraction ?? path.time_to_traction, "3-6 months"),
      key_adjustments: asArray(path.keyChanges ?? path.key_adjustments),
      milestones,
      path_specific_risks: asArray(path.risks ?? path.path_specific_risks),
      path_rationale: str(path.rationale, erector ? "Built from Erector intelligence." : ""),
    });
  }

  await db.insert(validationBhudhiResearchLog).values({
    validation_run_id: validationRunId,
    research_phase: "erector_sync",
    search_query: "Erector validation pipeline (market, competitors, economy)",
    search_results_count: competitors.length,
    extracted_insights: { reality_score: reality, verdict: row.verdict },
    sources: [],
    status: "success",
  });
}

export function verdictLabel(score: number): string {
  if (score >= 75) return "Good Potential";
  if (score >= 55) return "Moderate Potential";
  if (score >= 35) return "Needs Work";
  return "High Risk";
}

export function verdictBadge(score: number, verdict: string): string {
  if (verdict === "proceed") return "Strong Foundation";
  if (verdict === "adjust") return "Worth Pursuing with Adjustments";
  return "Reconsider Direction";
}

export async function patchValidationRunFromLegacyRow(
  validationRunId: string,
  row: ValidationRow,
): Promise<void> {
  const score = row.reality_score != null ? Math.round(Number(row.reality_score)) : 0;
  const verdict = (row.verdict ?? "adjust") as string;
  await db
    .update(validationRuns)
    .set({
      legacy_validation_id: row.id,
      status: "complete",
      verdict,
      reality_score: score,
      reality_score_label: verdictLabel(score),
      verdict_summary:
        row.recommendation ??
        row.ai_summary ??
        (verdict === "proceed"
          ? "This direction is worth pursuing."
          : verdict === "adjust"
            ? "Proceed with the recommended path adjustments."
            : "Pivot or refine before launch."),
      verdict_badge: verdictBadge(score, verdict),
      research_completed_at: new Date(),
      selected_path: row.selected_path ?? row.selected_path_type ?? "adjusted",
    })
    .where(eq(validationRuns.id, validationRunId));
}
