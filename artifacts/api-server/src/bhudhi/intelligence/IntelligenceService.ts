import { db, bhudhiRecommendations } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BhudhiRecommendation } from "@workspace/db/types/bhudhi";
import {
  frameworkApplicatorEngine,
  contradictionResolutionEngine,
  scenarioSimulatorEngine,
  recommendationEngine,
  enrichRecommendation,
} from "./intelligenceEngines.js";
import {
  loadLatestInvestigations,
  getCurrentDomain,
  getFrameworksForDomain,
  loadValidatedLearnings,
  getDependencyStats,
  isGoalAligned,
  updateIntelligenceEngineMetrics,
} from "./intelligenceData.js";
import type { EnrichedRecommendation } from "./types.js";
import { INTELLIGENCE_SYNTHESIS_ENGINE_ID } from "./types.js";
import { logger } from "../../lib/logger.js";

export interface StoredRecommendation extends BhudhiRecommendation {
  risks?: EnrichedRecommendation["risks"];
  dependencies?: EnrichedRecommendation["dependencies"];
  feasibility?: EnrichedRecommendation["feasibility"];
  stakeholderImpact?: EnrichedRecommendation["stakeholderImpact"];
  strategicAlignment?: EnrichedRecommendation["strategicAlignment"];
  learningsUsed?: string[];
  optimization?: EnrichedRecommendation["optimization"];
  scenario?: string;
  frameworkId?: string;
}

function toStored(row: typeof bhudhiRecommendations.$inferSelect): StoredRecommendation {
  const impact = (row.expected_impact ?? {}) as Record<string, unknown>;
  const intel = (impact["intelligence"] ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    engineId: row.engine_id,
    title: row.title,
    description: row.description,
    reasoning: row.reasoning,
    expectedImpact: {
      revenue: impact["revenue"] as number | undefined,
      efficiency: impact["efficiency"] as number | undefined,
      risk: impact["risk"] as number | undefined,
      timeline: impact["timeline"] as number | undefined,
    },
    confidence: row.confidence,
    implementationDifficulty: row.implementation_difficulty as BhudhiRecommendation["implementationDifficulty"],
    status: row.status as BhudhiRecommendation["status"],
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    risks: intel["risks"] as StoredRecommendation["risks"],
    dependencies: intel["dependencies"] as StoredRecommendation["dependencies"],
    feasibility: intel["feasibility"] as StoredRecommendation["feasibility"],
    stakeholderImpact: intel["stakeholderImpact"] as StoredRecommendation["stakeholderImpact"],
    strategicAlignment: intel["strategicAlignment"] as StoredRecommendation["strategicAlignment"],
    learningsUsed: intel["learningsUsed"] as string[] | undefined,
    optimization: intel["optimization"] as StoredRecommendation["optimization"],
    scenario: intel["scenario"] as string | undefined,
    frameworkId: intel["frameworkId"] as string | undefined,
  };
}

function packExpectedImpact(rec: EnrichedRecommendation) {
  return {
    revenue: rec.expectedImpact.revenue,
    efficiency: rec.expectedImpact.efficiency,
    risk: rec.expectedImpact.risk,
    timeline: rec.expectedImpact.timeline,
    intelligence: {
      risks: rec.risks,
      dependencies: rec.dependencies,
      feasibility: rec.feasibility,
      stakeholderImpact: rec.stakeholderImpact,
      strategicAlignment: rec.strategicAlignment,
      learningsUsed: rec.learningsUsed,
      optimization: rec.optimization,
      scenario: rec.scenario,
      frameworkId: rec.frameworkId,
    },
  };
}

export class IntelligenceService {
  /**
   * Full intelligence pipeline: investigations → frameworks → recommendations.
   */
  async analyzeAndRecommend(blueprintId: string): Promise<StoredRecommendation[]> {
    const started = Date.now();
    const investigations = await loadLatestInvestigations(blueprintId);

    if (investigations.length === 0) {
      logger.info({ blueprintId }, "[Intelligence] No investigations — run investigate first");
    }

    const domain = await getCurrentDomain(blueprintId);
    const frameworks = await getFrameworksForDomain(domain);
    const { pendingDeps, blockerCount } = await getDependencyStats(blueprintId);
    const goalAligned = await isGoalAligned(blueprintId);
    const learningsUsed = await loadValidatedLearnings();

    // ENGINE 1
    const frameworkAnalysis = frameworkApplicatorEngine(investigations, frameworks);
    // ENGINE 2
    const resolvedAnalysis = contradictionResolutionEngine(frameworkAnalysis);
    // ENGINE 3
    const scenarios = scenarioSimulatorEngine(blueprintId, resolvedAnalysis);
    // ENGINE 4
    const drafts = recommendationEngine(resolvedAnalysis, scenarios);

    const stored: StoredRecommendation[] = [];

    for (const draft of drafts) {
      // ENGINES 5–12 via enrichRecommendation
      const enriched = enrichRecommendation(
        draft,
        scenarios,
        pendingDeps,
        blockerCount,
        goalAligned,
        learningsUsed,
      );

      const [row] = await db
        .insert(bhudhiRecommendations)
        .values({
          blueprint_id: blueprintId,
          engine_id: INTELLIGENCE_SYNTHESIS_ENGINE_ID,
          title: enriched.title,
          description: enriched.description,
          reasoning: enriched.reasoning,
          expected_impact: packExpectedImpact(enriched),
          confidence: enriched.confidence,
          implementation_difficulty: enriched.implementationDifficulty,
          status: "pending",
        })
        .returning();

      stored.push(toStored(row!));
    }

    await updateIntelligenceEngineMetrics(
      INTELLIGENCE_SYNTHESIS_ENGINE_ID,
      stored.length,
      Date.now() - started,
    );

    return stored;
  }

  async listRecommendations(blueprintId: string): Promise<StoredRecommendation[]> {
    const rows = await db
      .select()
      .from(bhudhiRecommendations)
      .where(eq(bhudhiRecommendations.blueprint_id, blueprintId));
    return rows.map(toStored);
  }

  async getRecommendation(id: string): Promise<StoredRecommendation | null> {
    const [row] = await db
      .select()
      .from(bhudhiRecommendations)
      .where(eq(bhudhiRecommendations.id, id))
      .limit(1);
    return row ? toStored(row) : null;
  }
}

export const intelligenceService = new IntelligenceService();
