/**
 * Prompt 34B — Scene system (sequence 25).
 */
import { db, blueprints, orders, phases } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export interface SceneTriple {
  currentScene: string;
  expectedScene: string;
  idealScene: string;
  projectedScene?: string;
  sceneProbability?: number;
  howToMoveForward?: string;
}

export async function computeSceneFromBlueprint(
  blueprintId: string,
  condition: string,
  signals?: Record<string, number>,
): Promise<SceneTriple> {
  const [bp] = await db
    .select({
      goal: blueprints.goal,
      purpose: blueprints.purpose,
      timeframe_days: blueprints.timeframe_days,
      tier: blueprints.tier,
    })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const [countRow] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(eq(orders.blueprint_id, blueprintId));

  const completed = countRow?.completed ?? 0;
  const total = countRow?.total ?? 0;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const [activePhase] = await db
    .select({ name: phases.name, title: phases.title })
    .from(phases)
    .where(and(eq(phases.blueprint_id, blueprintId), eq(phases.is_active, true)))
    .limit(1);

  const phaseLabel = activePhase?.title ?? activePhase?.name ?? "execution";
  const goalShort = (bp?.goal ?? "your goal").slice(0, 80);
  const production = signals?.Production ?? 0.5;

  const currentScene = `${phaseLabel} phase — ${progressPct}% complete (${condition})`;
  const expectedScene =
    bp?.timeframe_days != null
      ? `On track for measurable progress within ${bp.timeframe_days} days at current pace`
      : `Progress toward: ${goalShort}`;
  const idealScene = `Goal achieved: ${goalShort}`;
  const projectedScene =
    bp?.tier === "ultimate"
      ? `Projected outcome if execution holds: ${Math.round(production * 100)}% signal strength`
      : undefined;
  const howToMoveForward =
    condition === "danger" || condition === "urgency"
      ? "Complete the next recovery-focused order and submit proof before expanding scope."
      : "Complete the next order and submit feedback to refresh the task queue.";

  return {
    currentScene,
    expectedScene,
    idealScene,
    projectedScene,
    sceneProbability: bp?.tier === "ultimate" ? Math.max(0.1, Math.min(0.95, production)) : undefined,
    howToMoveForward,
  };
}
