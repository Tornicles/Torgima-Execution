/**
 * BHUDHI_UPGRADE_PROMPT 3 — external intelligence (EIS) for task context.
 */
import { db, externalIntelligence, blueprints, signalSnapshots } from "@workspace/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { routeBhudhiRequest } from "./TriggerRouter.js";

export interface ExternalIntelligenceRecord {
  id: string;
  userId: string;
  blueprintId: string;
  domain: string;
  goalSummary: string;
  marketTrends: string[];
  opportunitySignals: string[];
  riskSignals: string[];
  competitorMoves: string[];
  executionRecommendation: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  generatedAt: Date;
  expiresAt: Date;
  sourceType: "BHUDHI_KNOWLEDGE" | "WEB_SEARCH";
}

function rowToRecord(row: typeof externalIntelligence.$inferSelect): ExternalIntelligenceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    blueprintId: row.blueprint_id,
    domain: row.domain,
    goalSummary: row.goal_summary ?? "",
    marketTrends: (row.market_trends as string[]) ?? [],
    opportunitySignals: (row.opportunity_signals as string[]) ?? [],
    riskSignals: (row.risk_signals as string[]) ?? [],
    competitorMoves: (row.competitor_moves as string[]) ?? [],
    executionRecommendation: row.execution_recommendation ?? "",
    confidence: (row.confidence as "LOW" | "MEDIUM" | "HIGH") ?? "LOW",
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    sourceType: (row.source_type as "BHUDHI_KNOWLEDGE" | "WEB_SEARCH") ?? "BHUDHI_KNOWLEDGE",
  };
}

export const ExternalIntelligenceService = {
  async generateIntelligence(params: {
    userId: string;
    blueprintId: string;
    stateVersion?: number;
  }): Promise<ExternalIntelligenceRecord | null> {
    const [bp] = await db
      .select({
        goal: blueprints.goal,
        current_domain: blueprints.current_domain,
        state_version: blueprints.state_version,
      })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);

    if (!bp) return null;

    const [signal] = await db
      .select({
        assigned_condition: signalSnapshots.assigned_condition,
        momentum: signalSnapshots.momentum,
        completion_rate: signalSnapshots.completion_rate,
      })
      .from(signalSnapshots)
      .where(
        and(
          eq(signalSnapshots.blueprint_id, params.blueprintId),
          eq(signalSnapshots.is_current, true),
        ),
      )
      .limit(1);

    const result = await routeBhudhiRequest<{
      marketTrends?: string[];
      opportunitySignals?: string[];
      riskSignals?: string[];
      competitorMoves?: string[];
      executionRecommendation?: string;
      confidence?: string;
    }>({
      sourceEngine: "EIS_WORKER",
      triggerType: "EXTERNAL_INTELLIGENCE_SCAN",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: params.stateVersion ?? bp.state_version ?? 0,
      requestedMode: "INTERPRET",
      idempotencyKey: `eis:${params.blueprintId}:${Date.now()}`,
      facts: {
        goalText: bp.goal,
        domain: bp.current_domain ?? "genesis",
        signalSummary: signal
          ? `condition=${signal.assigned_condition} momentum=${signal.momentum} completion=${signal.completion_rate}`
          : "none",
      },
    });

    const data = result.ok && result.output?.data ? result.output.data : null;
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    const [row] = await db
      .insert(externalIntelligence)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId,
        domain: bp.current_domain ?? "genesis",
        goal_summary: (bp.goal ?? "").slice(0, 200),
        market_trends: data?.marketTrends ?? [],
        opportunity_signals: data?.opportunitySignals ?? [],
        risk_signals: data?.riskSignals ?? [],
        competitor_moves: data?.competitorMoves ?? [],
        execution_recommendation:
          data?.executionRecommendation ??
          "Market intelligence unavailable — use general execution principles.",
        confidence: (data?.confidence as string) ?? "LOW",
        source_type: "BHUDHI_KNOWLEDGE",
        expires_at: expiresAt,
      })
      .returning();

    return row ? rowToRecord(row) : null;
  },

  async getLatestForBlueprint(blueprintId: string): Promise<ExternalIntelligenceRecord | null> {
    const [row] = await db
      .select()
      .from(externalIntelligence)
      .where(
        and(
          eq(externalIntelligence.blueprint_id, blueprintId),
          gt(externalIntelligence.expires_at, new Date()),
        ),
      )
      .orderBy(desc(externalIntelligence.generated_at))
      .limit(1);

    return row ? rowToRecord(row) : null;
  },

  injectIntoTaskContext(intel: ExternalIntelligenceRecord): string {
    const trend = intel.marketTrends[0] ?? "General market conditions apply.";
    const opp = intel.opportunitySignals[0] ?? "Focus on validated demand signals.";
    const risk = intel.riskSignals[0] ?? "Monitor execution risk.";
    const action = intel.executionRecommendation.slice(0, 200);
    return `Market context: ${trend}. Opportunity: ${opp}. Risk to note: ${risk}. Action note: ${action}`;
  },
};
