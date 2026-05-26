import {
  computeExecutionStats,
  createExecutionContext,
  fetchExecutionContext,
  fetchExecutionHistory,
  fetchExecutionStep,
  insertExecutionFeedback,
  insertExecutionResult,
  insertExecutionStep,
  newExecutionId,
  updateExecutionContext,
  updateExecutionStep,
} from "./runtimeData.js";
import type {
  ExecutionCompleteResult,
  ExecutionInput,
  ExecutionStats,
  StoredExecutionContext,
} from "./contracts/types.js";

export class ExecutionRuntime {
  async start(input: ExecutionInput): Promise<string> {
    const executionId = newExecutionId();
    await createExecutionContext(input, executionId);
    return executionId;
  }

  async getContext(executionId: string): Promise<StoredExecutionContext | null> {
    return fetchExecutionContext(executionId);
  }

  async updateStatus(executionId: string, status: string, progress?: number) {
    return updateExecutionContext(executionId, {
      status: status as StoredExecutionContext["status"],
      progress,
      ...(status === "running" ? {} : {}),
    });
  }

  async addStep(executionId: string, stepNumber: number, action: string, dependsOn?: string[]) {
    return insertExecutionStep(executionId, stepNumber, action, dependsOn ?? []);
  }

  async runStep(
    stepId: string,
    handler: (context: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ) {
    const step = await fetchExecutionStep(stepId);
    if (!step) throw new Error(`Step not found: ${stepId}`);

    const startedAt = new Date();
    await updateExecutionStep(stepId, { status: "running", startedAt });

    try {
      const result = await handler({});
      const completedAt = new Date();
      await updateExecutionStep(stepId, {
        status: "completed",
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        result,
      });
      return result;
    } catch (err) {
      await updateExecutionStep(stepId, {
        status: "failed",
        completedAt: new Date(),
      });
      throw err;
    }
  }

  async addFeedback(
    executionId: string,
    feedbackType: string,
    message: string,
    source: string,
    data?: Record<string, unknown>,
  ) {
    return insertExecutionFeedback(executionId, feedbackType, message, source, data ?? {});
  }

  async complete(
    executionId: string,
    success: boolean,
    outcome: string,
    output: Record<string, unknown>,
  ): Promise<ExecutionCompleteResult> {
    const context = await fetchExecutionContext(executionId);
    if (!context) throw new Error(`Context not found: ${executionId}`);

    const durationMs = Date.now() - context.startedAt.getTime();

    await updateExecutionContext(executionId, {
      status: success ? "completed" : "failed",
      progress: 100,
      output,
      completedAt: new Date(),
    });

    await insertExecutionResult(
      executionId,
      success,
      outcome,
      {
        accuracy: success ? 1 : 0,
        speedMs: durationMs,
        quality: success ? 1 : 0,
      },
      (output.learnings as Record<string, unknown>) ?? {},
      success ? ["execution_completed"] : [],
    );

    return { success, outcome, durationMs, executionId };
  }

  async getHistory(blueprintId: string, limit = 50) {
    return fetchExecutionHistory(blueprintId, limit);
  }

  async getStats(blueprintId: string): Promise<ExecutionStats> {
    return computeExecutionStats(blueprintId);
  }
}

export const executionRuntime = new ExecutionRuntime();
