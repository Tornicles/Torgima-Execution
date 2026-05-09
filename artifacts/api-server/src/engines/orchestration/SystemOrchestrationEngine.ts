import { logger } from "../../lib/logger.js";
import { ExecutionLoopEngine } from "../execution-loop/ExecutionLoopEngine.js";
import { SignalCalculationEngine } from "../signal/SignalCalculationEngine.js";
import { ConditionEvaluationEngine } from "../condition/ConditionEvaluationEngine.js";
import { ControlEngine } from "../control/ControlEngine.js";
import { TaskGenerationEngine } from "../task-generation/TaskGenerationEngine.js";

/**
 * SystemOrchestrationEngine — The top-level coordinator.
 * Wires all engines together and provides a single entry point
 * for the worker layer.
 *
 * TODO (Prompt 5): Implement full orchestration with error handling and recovery
 */
export class SystemOrchestrationEngine {
  private executionLoop = new ExecutionLoopEngine();
  private signalCalc = new SignalCalculationEngine();
  private conditionEval = new ConditionEvaluationEngine();
  private control = new ControlEngine();
  private taskGen = new TaskGenerationEngine();

  async orchestrate(blueprintId: string, userId: string): Promise<void> {
    logger.info({ blueprintId, userId }, "SystemOrchestrationEngine.orchestrate — TODO");
    await this.executionLoop.runLoop(blueprintId, userId);
  }
}
