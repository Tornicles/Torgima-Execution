import {
  db,
  bhudhiExecutionEvents,
  bhudhiFrameworks,
  bhudhiFrameworkLearning,
} from "@workspace/db";
import { and, desc, eq, like } from "drizzle-orm";
import { intelligenceService } from "../intelligence/IntelligenceService.js";
import { frameworksService } from "../frameworks/FrameworksService.js";
import { FRAMEWORK_CATALOG } from "../frameworks/frameworkCatalog.js";
import { normalizeFrameworkName } from "../frameworks/frameworkNameAliases.js";
import {
  buildDomainExpertiseFromEvents,
  computeOutcomeAccuracy,
  extractLearningsFromEvents,
  testHypothesisStats,
} from "./preservationLogic.js";
import type {
  DomainExpertiseResult,
  FrameworkImprovementEntry,
  HypothesisTestResult,
  KnowledgeConsolidationResult,
  OutcomeTrackingResult,
} from "./types.js";
import { logger } from "../../lib/logger.js";

export class PreservationService {
  async trackOutcome(
    blueprintId: string,
    recommendationId: string,
    actualOutcome: number,
    expectedOutcome: number,
  ): Promise<OutcomeTrackingResult | null> {
    const recommendation = await intelligenceService.getRecommendation(recommendationId);
    if (!recommendation || recommendation.blueprintId !== blueprintId) {
      return null;
    }

    const accuracy = computeOutcomeAccuracy(actualOutcome, expectedOutcome);
    const frameworkId = this.resolveFrameworkId(recommendation.frameworkId, recommendation.title);

    if (frameworkId) {
      await frameworksService.updateFrameworkAccuracy(
        frameworkId,
        actualOutcome,
        expectedOutcome,
      );
      logger.info(
        { blueprintId, recommendationId, frameworkId, accuracy },
        "[Preservation] outcome tracked",
      );
      return { accuracy, learning: true, frameworkId };
    }

    return { accuracy, learning: false };
  }

  private resolveFrameworkId(
    explicitId: string | undefined,
    title: string,
  ): string | undefined {
    if (explicitId) return explicitId;

    const firstToken = title.split(/\s+/)[0] ?? "";
    const canonical = normalizeFrameworkName(firstToken);
    const match = FRAMEWORK_CATALOG.find(
      (f) => f.name === canonical || f.id === canonical.toLowerCase(),
    );
    return match?.id;
  }

  async extractLearnings(blueprintId: string): Promise<string[]> {
    const events = await db
      .select({
        event_type: bhudhiExecutionEvents.event_type,
        description: bhudhiExecutionEvents.description,
        data: bhudhiExecutionEvents.data,
        learnings_generated: bhudhiExecutionEvents.learnings_generated,
        frameworks_improved: bhudhiExecutionEvents.frameworks_improved,
      })
      .from(bhudhiExecutionEvents)
      .where(eq(bhudhiExecutionEvents.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiExecutionEvents.created_at))
      .limit(30);

    return extractLearningsFromEvents(
      events.map((e) => ({
        event_type: e.event_type,
        description: e.description,
        data: e.data as Record<string, unknown>,
        learnings_generated: e.learnings_generated as string[],
        frameworks_improved: e.frameworks_improved as string[],
      })),
    );
  }

  async consolidateKnowledge(blueprintId: string): Promise<KnowledgeConsolidationResult> {
    const learnings = await this.extractLearnings(blueprintId);

    await db.insert(bhudhiExecutionEvents).values({
      blueprint_id: blueprintId,
      event_type: "task_completed",
      description: "Knowledge consolidation",
      data: { consolidated: true, learningsCount: learnings.length },
      learnings_generated: learnings,
      frameworks_improved: [],
    });

    return {
      success: true,
      learningsConsolidated: learnings.length,
      learnings,
    };
  }

  async improveFrameworks(
    _blueprintId: string,
  ): Promise<Record<string, FrameworkImprovementEntry>> {
    const frameworks = await db
      .select()
      .from(bhudhiFrameworks)
      .where(eq(bhudhiFrameworks.status, "active"));

    const improvements: Record<string, FrameworkImprovementEntry> = {};

    for (const framework of frameworks) {
      const learnings = await db
        .select({ improvement: bhudhiFrameworkLearning.improvement })
        .from(bhudhiFrameworkLearning)
        .where(
          and(
            eq(bhudhiFrameworkLearning.framework_id, framework.id),
            eq(bhudhiFrameworkLearning.status, "validated"),
          ),
        )
        .orderBy(desc(bhudhiFrameworkLearning.created_at))
        .limit(10);

      if (learnings.length === 0) continue;

      const avgImprovement =
        learnings.reduce((sum, l) => sum + Number(l.improvement), 0) / learnings.length;

      if (avgImprovement <= 0) continue;

      const prev = Number(framework.accuracy);
      const next = Math.min(prev + avgImprovement, 1);

      await db
        .update(bhudhiFrameworks)
        .set({
          accuracy: next,
          version: framework.version + 1,
          updated_at: new Date(),
        })
        .where(eq(bhudhiFrameworks.id, framework.id));

      improvements[framework.name] = {
        previousAccuracy: prev,
        newAccuracy: next,
        improvement: avgImprovement,
        version: framework.version + 1,
      };
    }

    return improvements;
  }

  async buildDomainExpertise(
    blueprintId: string,
    domain: string,
  ): Promise<Record<string, DomainExpertiseResult>> {
    const events = await db
      .select({
        event_type: bhudhiExecutionEvents.event_type,
        description: bhudhiExecutionEvents.description,
        data: bhudhiExecutionEvents.data,
        learnings_generated: bhudhiExecutionEvents.learnings_generated,
        frameworks_improved: bhudhiExecutionEvents.frameworks_improved,
      })
      .from(bhudhiExecutionEvents)
      .where(
        and(
          eq(bhudhiExecutionEvents.blueprint_id, blueprintId),
          like(bhudhiExecutionEvents.description, `%${domain}%`),
        ),
      )
      .orderBy(desc(bhudhiExecutionEvents.created_at))
      .limit(50);

    const expertise = buildDomainExpertiseFromEvents(
      events.map((e) => ({
        event_type: e.event_type,
        description: e.description,
        data: e.data as Record<string, unknown>,
        learnings_generated: e.learnings_generated as string[],
        frameworks_improved: e.frameworks_improved as string[],
      })),
    );

    return { [domain]: expertise };
  }

  testHypothesis(
    hypothesis: string,
    control: number,
    experimental: number,
  ): HypothesisTestResult {
    return testHypothesisStats(hypothesis, control, experimental);
  }
}

export const preservationService = new PreservationService();
