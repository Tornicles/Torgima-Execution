import {
  blueprintFrameworkSignals,
  blueprints,
  db,
  orders,
  ultimateScenes,
} from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { computeSceneFromBlueprint } from "../sequence/sequenceSceneEngine.js";
import { ULTIMATE_SEQUENCE_NUMBER } from "./ultimateGate.js";
import type { SceneStateSnapshot } from "../../types/ultimate.js";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function calculateDivergence(current: SceneStateSnapshot, expected: Record<string, unknown>): number {
  const progressCurrent = current.progress_percentage ?? 0;
  const progressExpected = Number(expected.tasks_expected_at_seq ?? 5) * 5;
  const prodCurrent = current.production_signal ?? 0;
  const prodExpected = Number(expected.expected_production ?? 0.75);
  const opsCurrent = current.operations_signal ?? 0;
  const opsExpected = Number(expected.expected_operations ?? 0.75);

  const factors = [
    { weight: 0.3, diff: Math.abs(progressCurrent - progressExpected) / 100 },
    { weight: 0.35, diff: Math.abs(prodCurrent - prodExpected) },
    { weight: 0.35, diff: Math.abs(opsCurrent - opsExpected) },
  ];

  return clamp01(factors.reduce((s, f) => s + f.diff * f.weight, 0));
}

function identifyBlockerGaps(current: SceneStateSnapshot, expected: Record<string, unknown>): string[] {
  const gaps: string[] = [];
  const progressExpected = Number(expected.tasks_expected_at_seq ?? 5) * 5;
  if ((current.progress_percentage ?? 0) < progressExpected) {
    gaps.push("Progress behind schedule");
  }
  if ((current.production_signal ?? 0) < Number(expected.expected_production ?? 0.75)) {
    gaps.push("Task completion rate below expectation");
  }
  if ((current.operations_signal ?? 0) < Number(expected.expected_operations ?? 0.75)) {
    gaps.push("Work quality below target");
  }
  return gaps;
}

function identifyOpportunityGaps(
  current: SceneStateSnapshot,
  ideal: Record<string, unknown>,
): string[] {
  const gaps: string[] = [];
  if ((current.progress_percentage ?? 0) < Number(ideal.completion_rate ?? 0.95) * 100) {
    gaps.push("Potential to accelerate task completion");
  }
  if ((current.production_signal ?? 0) < Number(ideal.production_signal ?? 0.95)) {
    gaps.push("Opportunity to improve execution consistency");
  }
  if ((current.operations_signal ?? 0) < Number(ideal.operations_signal ?? 0.95)) {
    gaps.push("Potential to enhance work quality");
  }
  return gaps;
}

function expectedConditionAtSeq(seq: number): string {
  if (seq < 10) return "danger";
  if (seq < 15) return "urgency";
  if (seq < 20) return "stability";
  return "power";
}

async function loadFrameworkSignals(blueprintId: string) {
  const rows = await db
    .select({ signal_key: blueprintFrameworkSignals.signal_key, value: blueprintFrameworkSignals.value })
    .from(blueprintFrameworkSignals)
    .where(eq(blueprintFrameworkSignals.blueprint_id, blueprintId));

  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.signal_key] = r.value ?? 0.5;
  }
  return map;
}

export const SceneEngine = {
  async createScene(blueprintId: string) {
    const [bp] = await db
      .select({
        current_condition: blueprints.current_condition,
        current_sequence_number: blueprints.current_sequence_number,
      })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    if (!bp) throw new Error("Blueprint not found");

    const signals = await loadFrameworkSignals(blueprintId);
    const condition = bp.current_condition ?? "stability";
    const triple = await computeSceneFromBlueprint(blueprintId, condition, {
      Production: signals.Production ?? signals.production ?? 0.5,
      Operations: signals.Operations ?? signals.operations ?? 0.5,
    });

    const [countRow] = await db
      .select({
        completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(eq(orders.blueprint_id, blueprintId));

    const completed = countRow?.completed ?? 0;
    const total = countRow?.total ?? 0;
    const seq = bp.current_sequence_number ?? ULTIMATE_SEQUENCE_NUMBER;

    const currentState: SceneStateSnapshot = {
      tasks_completed: completed,
      tasks_total: total,
      progress_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      production_signal: signals.Production ?? signals.production ?? 0.5,
      operations_signal: signals.Operations ?? signals.operations ?? 0.5,
      condition,
      current_scene_text: triple.currentScene,
      timestamp: new Date().toISOString(),
    };

    const expectedState = {
      tasks_expected_at_seq: Math.ceil(seq * 1.5),
      min_quality_score: 0.7,
      expected_condition: expectedConditionAtSeq(seq),
      expected_production: 0.75,
      expected_operations: 0.75,
      expected_scene_text: triple.expectedScene,
    };

    const idealState = {
      completion_rate: 0.95,
      quality_score: 1,
      production_signal: 0.95,
      operations_signal: 0.95,
      zero_blockers: true,
      ideal_scene_text: triple.idealScene,
    };

    const divergence = calculateDivergence(currentState, expectedState);
    const blockerGaps = identifyBlockerGaps(currentState, expectedState);
    const opportunityGaps = identifyOpportunityGaps(currentState, idealState);

    const [scene] = await db
      .insert(ultimateScenes)
      .values({
        blueprint_id: blueprintId,
        sequence_number: seq,
        current_state: currentState,
        expected_state: expectedState,
        ideal_state: idealState,
        current_vs_expected: divergence,
        expected_vs_ideal: 0.75,
        blocker_gaps: blockerGaps,
        opportunity_gaps: opportunityGaps,
      })
      .returning();

    return {
      scene: scene!,
      current_state: currentState,
      expected_state: expectedState,
      ideal_state: idealState,
      divergence,
      triple,
    };
  },

  async getLatestScene(blueprintId: string) {
    const [scene] = await db
      .select()
      .from(ultimateScenes)
      .where(eq(ultimateScenes.blueprint_id, blueprintId))
      .orderBy(desc(ultimateScenes.created_at))
      .limit(1);
    return scene ?? null;
  },
};
