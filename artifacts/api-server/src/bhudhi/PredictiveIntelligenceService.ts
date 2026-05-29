/**
 * BHUDHI_UPGRADE_PROMPT 4 — predictive intelligence (PIS).
 */
import {
  db,
  predictionSnapshots,
  signalSnapshots,
  conditions,
  behaviorPatterns,
  cognitiveLoadScores,
  milestones,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { routeBhudhiRequest } from "./TriggerRouter.js";

export interface PredictionResult {
  userId: string;
  blueprintId: string;
  dropoutRisk: number;
  burnoutRisk: number;
  plateauRisk: number;
  scalingReadiness: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  primaryRisk: string | null;
  primaryOpportunity: string | null;
  recommendedAction:
    | "REDUCE_LOAD"
    | "MAINTAIN"
    | "INCREASE_INTENSITY"
    | "RECOVERY_MODE"
    | "SCALE_READY";
  generatedAt: Date;
  signalSnapshotId?: string;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function recommendAction(scores: {
  dropoutRisk: number;
  burnoutRisk: number;
  plateauRisk: number;
  scalingReadiness: number;
}): PredictionResult["recommendedAction"] {
  if (scores.dropoutRisk > 0.7) return "RECOVERY_MODE";
  if (scores.burnoutRisk > 0.7) return "REDUCE_LOAD";
  if (scores.scalingReadiness > 0.7) return "SCALE_READY";
  if (scores.plateauRisk > 0.6) return "INCREASE_INTENSITY";
  return "MAINTAIN";
}

export const PredictiveIntelligenceService = {
  async computeAndPersist(params: {
    userId: string;
    blueprintId: string;
    signalSnapshotId?: string;
    stateVersion?: number;
  }): Promise<PredictionResult> {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [cond] = await db
      .select({ condition: conditions.condition, entered_at: conditions.entered_at })
      .from(conditions)
      .where(
        and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)),
      )
      .limit(1);

    const snapshots = await db
      .select()
      .from(signalSnapshots)
      .where(eq(signalSnapshots.blueprint_id, params.blueprintId))
      .orderBy(desc(signalSnapshots.created_at))
      .limit(8);

    const snapshotCount = snapshots.length;
    const confidence: PredictionResult["confidence"] =
      snapshotCount < 3 ? "LOW" : snapshotCount <= 6 ? "MEDIUM" : "HIGH";

    const current = snapshots[0];
    const prior = snapshots[1];
    const condition = cond?.condition ?? current?.assigned_condition ?? "nothingness";
    const inDanger =
      (condition === "danger" || condition === "nothingness") &&
      cond?.entered_at &&
      cond.entered_at <= fiveDaysAgo;

    let dropoutRisk = 0.2;
    if (inDanger) dropoutRisk = 0.8;
    else if (
      current?.trend === "declining" &&
      prior?.trend === "declining"
    ) {
      dropoutRisk = 0.5;
    }

    const fatigue = await db
      .select()
      .from(behaviorPatterns)
      .where(
        and(
          eq(behaviorPatterns.blueprint_id, params.blueprintId),
          eq(behaviorPatterns.status, "active"),
        ),
      )
      .orderBy(desc(behaviorPatterns.last_detected_at))
      .limit(5);

    const fatigueHigh = fatigue.some(
      (p) =>
        (p.pattern_type === "burnout" || String(p.evidence_json).includes("FATIGUE")) &&
        (p.severity ?? "").toUpperCase() === "HIGH",
    );

    const loads = await db
      .select({
        load_score: cognitiveLoadScores.load_score,
        created_at: cognitiveLoadScores.created_at,
      })
      .from(cognitiveLoadScores)
      .where(
        and(
          eq(cognitiveLoadScores.blueprint_id, params.blueprintId),
          gte(cognitiveLoadScores.created_at, new Date(now.getTime() - 3 * 86400000)),
        ),
      );

    const highLoadDays = loads.filter((l) => (l.load_score ?? 0) > 0.8).length;
    let burnoutRisk = 0.2;
    if (fatigueHigh) burnoutRisk = 0.8;
    else if (highLoadDays >= 3) burnoutRisk = 0.7;

    const stabilityLong =
      condition === "stability" && cond?.entered_at && cond.entered_at <= twentyOneDaysAgo;
    const [recentMilestone] = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(
        and(
          eq(milestones.blueprint_id, params.blueprintId),
          gte(milestones.created_at, thirtyDaysAgo),
        ),
      )
      .limit(1);

    let plateauRisk = 0.1;
    if (stabilityLong) plateauRisk = 0.6;
    else if (!recentMilestone) plateauRisk = 0.3;

    let scalingReadiness = 0.1;
    const momentum = current?.momentum ?? 0;
    if (condition === "affluence" && momentum >= 7) scalingReadiness = 0.9;
    else if (condition === "power" && momentum >= 5 && burnoutRisk < 0.4) {
      scalingReadiness = 0.6;
    }

    const scores = {
      dropoutRisk: clamp01(dropoutRisk),
      burnoutRisk: clamp01(burnoutRisk),
      plateauRisk: clamp01(plateauRisk),
      scalingReadiness: clamp01(scalingReadiness),
    };

    let primaryRisk: string | null = null;
    let primaryOpportunity: string | null = null;

    if (confidence !== "LOW") {
      const narrative = await routeBhudhiRequest<{
        primaryRisk?: string | null;
        primaryOpportunity?: string | null;
      }>({
        sourceEngine: "PREDICTION_WORKER",
        triggerType: "PREDICTIVE_ANALYSIS",
        userId: params.userId,
        blueprintId: params.blueprintId,
        stateVersion: params.stateVersion ?? 0,
        requestedMode: "INTERPRET",
        idempotencyKey: `pis:${params.blueprintId}:${params.signalSnapshotId ?? Date.now()}`,
        facts: {
          dropout: scores.dropoutRisk,
          burnout: scores.burnoutRisk,
          plateau: scores.plateauRisk,
          scaling: scores.scalingReadiness,
          conditionSummary: condition,
        },
      });
      if (narrative.ok && narrative.output?.data) {
        primaryRisk =
          typeof narrative.output.data.primaryRisk === "string"
            ? narrative.output.data.primaryRisk.slice(0, 100)
            : null;
        primaryOpportunity =
          typeof narrative.output.data.primaryOpportunity === "string"
            ? narrative.output.data.primaryOpportunity.slice(0, 100)
            : null;
      }
    }

    const recommendedAction = recommendAction(scores);
    const generatedAt = new Date();

    await db.insert(predictionSnapshots).values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      dropout_risk: scores.dropoutRisk,
      burnout_risk: scores.burnoutRisk,
      plateau_risk: scores.plateauRisk,
      scaling_readiness: scores.scalingReadiness,
      confidence,
      primary_risk: primaryRisk,
      primary_opportunity: primaryOpportunity,
      recommended_action: recommendedAction,
      signal_snapshot_id: params.signalSnapshotId,
      generated_at: generatedAt,
    });

    return {
      userId: params.userId,
      blueprintId: params.blueprintId,
      ...scores,
      confidence,
      primaryRisk,
      primaryOpportunity,
      recommendedAction,
      generatedAt,
      signalSnapshotId: params.signalSnapshotId,
    };
  },

  async getLatestForBlueprint(blueprintId: string): Promise<PredictionResult | null> {
    const [row] = await db
      .select()
      .from(predictionSnapshots)
      .where(eq(predictionSnapshots.blueprint_id, blueprintId))
      .orderBy(desc(predictionSnapshots.generated_at))
      .limit(1);

    if (!row) return null;
    return {
      userId: row.user_id,
      blueprintId: row.blueprint_id,
      dropoutRisk: row.dropout_risk,
      burnoutRisk: row.burnout_risk,
      plateauRisk: row.plateau_risk,
      scalingReadiness: row.scaling_readiness,
      confidence: row.confidence as PredictionResult["confidence"],
      primaryRisk: row.primary_risk,
      primaryOpportunity: row.primary_opportunity,
      recommendedAction: row.recommended_action as PredictionResult["recommendedAction"],
      generatedAt: row.generated_at,
      signalSnapshotId: row.signal_snapshot_id ?? undefined,
    };
  },
};
