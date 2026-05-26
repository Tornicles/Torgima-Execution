import { ExecutionRuntime } from "../ExecutionRuntime.js";

export class TaskManager {
  constructor(private runtime: ExecutionRuntime = new ExecutionRuntime()) {}

  async execute(blueprintId: string, task: Record<string, unknown>) {
    const title = String(task.title ?? task.nextTask ?? "Task");
    const executionId = await this.runtime.start({
      blueprintId,
      executionType: "task",
      action: `Task: ${title}`,
      payload: task,
      estimatedDurationMs: 30_000,
    });

    try {
      await this.runtime.updateStatus(executionId, "running", 50);

      const result = {
        taskId: task.id ?? `task-${Date.now()}`,
        title,
        status: task.status ?? "completed",
        completed: true,
      };

      await this.runtime.complete(executionId, true, `Task completed: ${title}`, { result });

      return { success: true, executionId, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runtime.complete(executionId, false, `Task failed: ${message}`, { error: message });
      throw err;
    }
  }
}

export const taskManager = new TaskManager();
