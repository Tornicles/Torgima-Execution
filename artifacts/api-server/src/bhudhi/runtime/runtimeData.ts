import { randomUUID } from "node:crypto";
import {
  db,
  bhudhiUnifiedExecutionContexts,
  bhudhiUnifiedExecutionSteps,
  bhudhiUnifiedExecutionFeedback,
  bhudhiUnifiedExecutionResults,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import type {
  ExecutionInput,
  ExecutionStats,
  ExecutionStatus,
  StoredExecutionContext,
} from "./contracts/types.js";

function toContext(row: typeof bhudhiUnifiedExecutionContexts.$inferSelect): StoredExecutionContext {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    executionType: row.execution_type as StoredExecutionContext["executionType"],
    executionId: row.execution_id,
    action: row.action,
    input: row.input as Record<string, unknown>,
    status: row.status as ExecutionStatus,
    progress: row.progress,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    estimatedEnd: row.estimated_end,
    output: row.output as Record<string, unknown>,
    feedback: row.feedback as Record<string, unknown>,
    errors: (row.errors as string[]) ?? [],
    warnings: (row.warnings as string[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function newExecutionId(): string {
  return `exec_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export async function createExecutionContext(input: ExecutionInput, executionId: string) {
  const estimatedEnd = new Date(
    Date.now() + (input.estimatedDurationMs ?? 60_000),
  );

  const [row] = await db
    .insert(bhudhiUnifiedExecutionContexts)
    .values({
      blueprint_id: input.blueprintId,
      execution_type: input.executionType,
      execution_id: executionId,
      action: input.action,
      input: input.payload,
      status: "pending",
      estimated_end: estimatedEnd,
    })
    .returning();

  return toContext(row);
}

export async function fetchExecutionContext(executionId: string): Promise<StoredExecutionContext | null> {
  const [row] = await db
    .select()
    .from(bhudhiUnifiedExecutionContexts)
    .where(eq(bhudhiUnifiedExecutionContexts.execution_id, executionId))
    .limit(1);

  return row ? toContext(row) : null;
}

export async function updateExecutionContext(
  executionId: string,
  patch: Partial<{
    status: ExecutionStatus;
    progress: number;
    output: Record<string, unknown>;
    errors: string[];
    warnings: string[];
    completedAt: Date;
  }>,
): Promise<StoredExecutionContext | null> {
  const [row] = await db
    .update(bhudhiUnifiedExecutionContexts)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.progress !== undefined && { progress: patch.progress }),
      ...(patch.output !== undefined && { output: patch.output }),
      ...(patch.errors !== undefined && { errors: patch.errors }),
      ...(patch.warnings !== undefined && { warnings: patch.warnings }),
      ...(patch.completedAt !== undefined && { completed_at: patch.completedAt }),
      updated_at: new Date(),
    })
    .where(eq(bhudhiUnifiedExecutionContexts.execution_id, executionId))
    .returning();

  return row ? toContext(row) : null;
}

export async function insertExecutionStep(
  executionId: string,
  stepNumber: number,
  action: string,
  dependsOn: string[] = [],
) {
  const [row] = await db
    .insert(bhudhiUnifiedExecutionSteps)
    .values({
      execution_id: executionId,
      step_number: stepNumber,
      action,
      depends_on: dependsOn,
      status: "pending",
    })
    .returning();

  return row;
}

export async function updateExecutionStep(
  stepId: string,
  patch: Partial<{
    status: string;
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    result: Record<string, unknown>;
  }>,
) {
  const [row] = await db
    .update(bhudhiUnifiedExecutionSteps)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.startedAt !== undefined && { started_at: patch.startedAt }),
      ...(patch.completedAt !== undefined && { completed_at: patch.completedAt }),
      ...(patch.durationMs !== undefined && { duration_ms: patch.durationMs }),
      ...(patch.result !== undefined && { result: patch.result }),
    })
    .where(eq(bhudhiUnifiedExecutionSteps.id, stepId))
    .returning();

  return row;
}

export async function fetchExecutionStep(stepId: string) {
  const [row] = await db
    .select()
    .from(bhudhiUnifiedExecutionSteps)
    .where(eq(bhudhiUnifiedExecutionSteps.id, stepId))
    .limit(1);

  return row ?? null;
}

export async function insertExecutionFeedback(
  executionId: string,
  feedbackType: string,
  message: string,
  source: string,
  data: Record<string, unknown> = {},
) {
  const [row] = await db
    .insert(bhudhiUnifiedExecutionFeedback)
    .values({
      execution_id: executionId,
      feedback_type: feedbackType,
      message,
      source,
      data,
    })
    .returning();

  return row;
}

export async function insertExecutionResult(
  executionId: string,
  success: boolean,
  outcome: string,
  metrics: { accuracy: number; speedMs: number; quality: number },
  learnings: Record<string, unknown> = {},
  improvements: string[] = [],
) {
  const [row] = await db
    .insert(bhudhiUnifiedExecutionResults)
    .values({
      execution_id: executionId,
      success,
      outcome,
      metrics_accuracy: metrics.accuracy,
      metrics_speed_ms: metrics.speedMs,
      metrics_quality: metrics.quality,
      learnings,
      improvements,
    })
    .onConflictDoUpdate({
      target: bhudhiUnifiedExecutionResults.execution_id,
      set: {
        success,
        outcome,
        metrics_accuracy: metrics.accuracy,
        metrics_speed_ms: metrics.speedMs,
        metrics_quality: metrics.quality,
        learnings,
        improvements,
      },
    })
    .returning();

  return row;
}

export async function fetchExecutionHistory(
  blueprintId: string,
  limit = 50,
): Promise<StoredExecutionContext[]> {
  const rows = await db
    .select()
    .from(bhudhiUnifiedExecutionContexts)
    .where(eq(bhudhiUnifiedExecutionContexts.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiUnifiedExecutionContexts.created_at))
    .limit(limit);

  return rows.map(toContext);
}

export async function computeExecutionStats(blueprintId: string): Promise<ExecutionStats> {
  const contexts = await db
    .select()
    .from(bhudhiUnifiedExecutionContexts)
    .where(eq(bhudhiUnifiedExecutionContexts.blueprint_id, blueprintId));

  if (contexts.length === 0) {
    return { total: 0, successful: 0, successRate: "0", byType: {} };
  }

  const execIds = contexts.map((c) => c.execution_id);
  const allResults = await db
    .select()
    .from(bhudhiUnifiedExecutionResults)
    .where(inArray(bhudhiUnifiedExecutionResults.execution_id, execIds));

  const resultMap = new Map(allResults.map((r) => [r.execution_id, r]));

  let successful = 0;
  const byType: Record<string, number> = {};

  for (const ctx of contexts) {
    byType[ctx.execution_type] = (byType[ctx.execution_type] ?? 0) + 1;
    if (resultMap.get(ctx.execution_id)?.success) successful += 1;
  }

  const total = contexts.length;
  return {
    total,
    successful,
    successRate: total > 0 ? (successful / total).toFixed(2) : "0",
    byType,
  };
}
