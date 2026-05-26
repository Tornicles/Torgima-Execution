import {
  db,
  bhudhiRecommendations,
  bhudhiExternalConnections,
  bhudhiExecutionEvents,
  bhudhiEngines,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { intelligenceService, type StoredRecommendation } from "../intelligence/IntelligenceService.js";

export async function loadRecommendation(recommendationId: string): Promise<StoredRecommendation | null> {
  return intelligenceService.getRecommendation(recommendationId);
}

export async function approveRecommendation(recommendationId: string): Promise<StoredRecommendation | null> {
  const [row] = await db
    .update(bhudhiRecommendations)
    .set({ status: "approved", updated_at: new Date() })
    .where(eq(bhudhiRecommendations.id, recommendationId))
    .returning();
  return row ? intelligenceService.getRecommendation(row.id) : null;
}

export async function markImplemented(recommendationId: string): Promise<void> {
  await db
    .update(bhudhiRecommendations)
    .set({
      status: "implemented",
      applied_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(bhudhiRecommendations.id, recommendationId));
}

export async function loadActiveConnections(blueprintId: string) {
  return db
    .select()
    .from(bhudhiExternalConnections)
    .where(eq(bhudhiExternalConnections.blueprint_id, blueprintId));
}

export async function logExecutionEvent(
  blueprintId: string,
  eventType: string,
  description: string,
  data: Record<string, unknown>,
): Promise<void> {
  await db.insert(bhudhiExecutionEvents).values({
    blueprint_id: blueprintId,
    event_type: eventType,
    description,
    data,
    learnings_generated: [],
    frameworks_improved: [],
  });
}

export async function updateOperatingEngineMetrics(
  engineId: string,
  elapsedMs: number,
  success: boolean,
): Promise<void> {
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
  const successRate = success
    ? Math.min(0.99, (prev.successRate ?? 0.9) + 0.01)
    : Math.max(0.5, (prev.successRate ?? 0.9) - 0.05);

  await db
    .update(bhudhiEngines)
    .set({
      metrics: {
        executionsCount,
        successRate,
        averageExecutionTime,
        lastResultCount: success ? 1 : 0,
      },
      last_run_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(bhudhiEngines.id, engineId));
}
