import { operatingService } from "../../operating/OperatingService.js";
import { ExecutionRuntime } from "../ExecutionRuntime.js";

export class DecisionExecutor {
  constructor(private runtime: ExecutionRuntime = new ExecutionRuntime()) {}

  async execute(blueprintId: string, decision: Record<string, unknown>) {
    const title = String(decision.title ?? decision.name ?? "Decision");
    const executionId = await this.runtime.start({
      blueprintId,
      executionType: "decision",
      action: `Execute: ${title}`,
      payload: decision,
    });

    try {
      await this.runtime.updateStatus(executionId, "running", 20);

      const step1 = await this.runtime.addStep(executionId, 1, "Prepare decision");
      await this.runtime.runStep(step1.id, async () => ({ prepared: true }));

      await this.runtime.updateStatus(executionId, "running", 40);

      const step2 = await this.runtime.addStep(executionId, 2, "Execute decision");
      const result = await this.runtime.runStep(step2.id, async () =>
        this.executeDecision(blueprintId, decision),
      );

      await this.runtime.updateStatus(executionId, "running", 70);

      const step3 = await this.runtime.addStep(executionId, 3, "Verify execution");
      const verified = await this.runtime.runStep(step3.id, async () => ({
        verified: Boolean(result.executed),
      }));

      const learnings = { learned: true, decisionId: result.decisionId };

      const complete = await this.runtime.complete(
        executionId,
        Boolean(verified.verified),
        verified.verified ? "Decision executed successfully" : "Decision execution failed",
        { result, learnings },
      );

      return { success: complete.success, executionId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runtime.addFeedback(executionId, "failure", message, "decision-executor");
      await this.runtime.complete(executionId, false, `Decision execution failed: ${message}`, {
        error: message,
      });
      throw err;
    }
  }

  private async executeDecision(blueprintId: string, decision: Record<string, unknown>) {
    const recommendationId = decision.recommendationId ?? decision.id;
    if (typeof recommendationId === "string") {
      const op = await operatingService.executeRecommendation(recommendationId);
      return {
        executed: op.success,
        decisionId: recommendationId,
        operating: op,
      };
    }

    return { executed: true, decisionId: decision.id ?? "synthetic", blueprintId };
  }
}

export const decisionExecutor = new DecisionExecutor();
