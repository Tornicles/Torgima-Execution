import {
  db,
  blueprints,
  bhudhiInvestigations,
  bhudhiFrameworks,
  bhudhiFrameworkLearning,
  bhudhiRecommendations,
  bhudhiEngines,
  orderDependencies,
  orders,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { BhudhiInvestigation } from "@workspace/db/types/bhudhi";
import type { FrameworkRow } from "./types.js";

function toInvestigation(row: typeof bhudhiInvestigations.$inferSelect): BhudhiInvestigation {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    engineId: row.engine_id,
    subject: row.subject as BhudhiInvestigation["subject"],
    findings: row.findings as BhudhiInvestigation["findings"],
    confidence: row.confidence,
    severity: row.severity as BhudhiInvestigation["severity"],
    actionable: row.actionable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadLatestInvestigations(
  blueprintId: string,
  limit = 20,
): Promise<BhudhiInvestigation[]> {
  const rows = await db
    .select()
    .from(bhudhiInvestigations)
    .where(eq(bhudhiInvestigations.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiInvestigations.created_at))
    .limit(limit);
  return rows.map(toInvestigation);
}

export async function getCurrentDomain(blueprintId: string): Promise<string> {
  const [bp] = await db
    .select({ domain: blueprints.domain })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return (bp?.domain ?? "delivery").toLowerCase();
}

export async function getFrameworksForDomain(domain: string): Promise<FrameworkRow[]> {
  const rows = await db.select().from(bhudhiFrameworks).where(eq(bhudhiFrameworks.status, "active"));
  return rows.filter((fw) => {
    const domains = fw.domains as string[];
    return Array.isArray(domains) && domains.includes(domain);
  }) as FrameworkRow[];
}

export async function loadValidatedLearnings(limit = 5): Promise<string[]> {
  const rows = await db
    .select({ learningType: bhudhiFrameworkLearning.learning_type })
    .from(bhudhiFrameworkLearning)
    .where(eq(bhudhiFrameworkLearning.status, "validated"))
    .orderBy(desc(bhudhiFrameworkLearning.created_at))
    .limit(limit);
  return rows.map((r) => r.learningType);
}

export async function getDependencyStats(blueprintId: string) {
  const [dep] = await db
    .select({ pending: sql<number>`count(*) filter (where ${orderDependencies.status} = 'pending')` })
    .from(orderDependencies)
    .where(eq(orderDependencies.blueprint_id, blueprintId));

  const [ord] = await db
    .select({
      blockers: sql<number>`count(*) filter (where ${orders.blocker_type} is not null)`,
    })
    .from(orders)
    .where(eq(orders.blueprint_id, blueprintId));

  return {
    pendingDeps: Number(dep?.pending ?? 0),
    blockerCount: Number(ord?.blockers ?? 0),
  };
}

export async function isGoalAligned(blueprintId: string): Promise<boolean> {
  const [bp] = await db
    .select({ goal: blueprints.goal, purpose: blueprints.purpose })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return Boolean(bp?.goal && bp.goal.length >= 10);
}

export async function updateIntelligenceEngineMetrics(engineId: string, resultCount: number, elapsedMs: number) {
  const [eng] = await db.select().from(bhudhiEngines).where(eq(bhudhiEngines.id, engineId)).limit(1);
  if (!eng) return;

  const prev = (eng.metrics ?? {}) as {
    executionsCount?: number;
    successRate?: number;
    averageExecutionTime?: number;
    lastResultCount?: number;
  };
  const executionsCount = (prev.executionsCount ?? 0) + 1;
  const prevAvg = prev.averageExecutionTime ?? 0;
  const averageExecutionTime = Math.round(
    (prevAvg * (executionsCount - 1) + elapsedMs) / executionsCount,
  );

  await db
    .update(bhudhiEngines)
    .set({
      metrics: {
        executionsCount,
        successRate: prev.successRate ?? 0.95,
        averageExecutionTime,
        lastResultCount: resultCount,
      },
      last_run_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(bhudhiEngines.id, engineId));
}

export { bhudhiRecommendations };
