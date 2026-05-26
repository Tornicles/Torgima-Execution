import {
  db,
  bhudhiExperiments,
  bhudhiExperimentGroups,
  bhudhiExperimentResults,
  bhudhiExperimentMemory,
  bhudhiExperimentPromotions,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { ExperimentCreateResult, ExperimentStatus } from "./contracts/types.js";

export async function persistExperiment(
  result: ExperimentCreateResult,
  input: { blueprintId: string; goal: string; metrics: string[] },
): Promise<void> {
  const criteria = result.successCriteria;

  await db.insert(bhudhiExperiments).values({
    id: result.experimentId,
    blueprint_id: input.blueprintId,
    goal: input.goal,
    hypothesis: result.hypothesis,
    status: "PENDING",
    duration_days: result.duration,
    success_criteria: criteria,
    metrics: input.metrics,
  });

  for (const g of result.groups) {
    await db.insert(bhudhiExperimentGroups).values({
      id: g.id,
      experiment_id: result.experimentId,
      group_key: g.groupKey,
      label: g.label,
      allocation_weight: g.allocationWeight,
    });
  }

  await db.insert(bhudhiExperimentMemory).values({
    experiment_id: result.experimentId,
    memory_type: "create",
    snapshot: result as unknown as Record<string, unknown>,
  });
}

export async function updateExperimentStatus(experimentId: string, status: ExperimentStatus): Promise<void> {
  await db
    .update(bhudhiExperiments)
    .set({ status, updated_at: new Date() })
    .where(eq(bhudhiExperiments.id, experimentId));
}

export async function persistMeasurement(
  experimentId: string,
  groupId: string | null,
  measurement: { delta: number; confidence: number; effectSize: number; verdict?: string; causal?: Record<string, unknown> },
): Promise<void> {
  await db.insert(bhudhiExperimentResults).values({
    experiment_id: experimentId,
    group_id: groupId,
    delta: measurement.delta,
    confidence: measurement.confidence,
    effect_size: measurement.effectSize,
    verdict: measurement.verdict ?? null,
    causal: measurement.causal ?? {},
  });
}

export async function persistPromotion(
  experimentId: string,
  blueprintId: string,
  promotion: {
    action: string;
    winnerGroup?: string;
    confidence: number;
    repeatability: number;
    governanceOk: boolean;
    reason: string;
  },
): Promise<void> {
  await db.insert(bhudhiExperimentPromotions).values({
    experiment_id: experimentId,
    blueprint_id: blueprintId,
    action: promotion.action,
    winner_group: promotion.winnerGroup ?? null,
    confidence: promotion.confidence,
    repeatability: promotion.repeatability,
    governance_ok: promotion.governanceOk,
    reason: promotion.reason,
  });
}

export async function getExperiment(experimentId: string) {
  const rows = await db
    .select()
    .from(bhudhiExperiments)
    .where(eq(bhudhiExperiments.id, experimentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listExperimentGroups(experimentId: string) {
  return db
    .select()
    .from(bhudhiExperimentGroups)
    .where(eq(bhudhiExperimentGroups.experiment_id, experimentId));
}

export async function listExperimentHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiExperiments)
    .where(eq(bhudhiExperiments.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiExperiments.created_at))
    .limit(limit);

  return rows.map((r) => ({
    experimentId: r.id,
    goal: r.goal,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function getRunningExperiment(blueprintId: string) {
  const rows = await db
    .select()
    .from(bhudhiExperiments)
    .where(eq(bhudhiExperiments.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiExperiments.updated_at))
    .limit(5);

  return rows.find((r) => r.status === "RUNNING" || r.status === "PENDING") ?? null;
}
