import type { ExecutionType } from "../contracts/types.js";
import { ExecutionRuntime, executionRuntime } from "../ExecutionRuntime.js";
import { DecisionExecutor, decisionExecutor } from "./DecisionExecutor.js";
import { SimulationExecutor, simulationExecutor } from "./SimulationExecutor.js";
import { TeamCoordinator, teamCoordinator } from "./TeamCoordinator.js";
import { OrganizationOrchestrator, organizationOrchestrator } from "./OrganizationOrchestrator.js";
import { TaskManager, taskManager } from "./TaskManager.js";

export class UnifiedExecutor {
  constructor(
    private runtime: ExecutionRuntime = executionRuntime,
    private decision = decisionExecutor,
    private simulation = simulationExecutor,
    private team = teamCoordinator,
    private organization = organizationOrchestrator,
    private tasks = taskManager,
  ) {}

  async execute(
    blueprintId: string,
    executionType: ExecutionType,
    payload: Record<string, unknown>,
  ) {
    switch (executionType) {
      case "decision":
        return this.decision.execute(blueprintId, payload);
      case "simulation":
        return this.simulation.execute(blueprintId, payload);
      case "team":
        return this.team.coordinate(blueprintId, payload);
      case "organization":
        return this.organization.execute(blueprintId, payload);
      case "task":
        return this.tasks.execute(blueprintId, payload);
      default:
        throw new Error(`Unknown execution type: ${String(executionType)}`);
    }
  }

  getStats(blueprintId: string) {
    return this.runtime.getStats(blueprintId);
  }

  getHistory(blueprintId: string, limit = 50) {
    return this.runtime.getHistory(blueprintId, limit);
  }

  getContext(executionId: string) {
    return this.runtime.getContext(executionId);
  }
}

export const unifiedExecutor = new UnifiedExecutor();
