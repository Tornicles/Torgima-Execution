import { executionCoordinator } from "../../organization/execution/ExecutionCoordinator.js";
import { ExecutionRuntime } from "../ExecutionRuntime.js";

export class OrganizationOrchestrator {
  constructor(private runtime: ExecutionRuntime = new ExecutionRuntime()) {}

  async execute(blueprintId: string, organization: Record<string, unknown>) {
    const name = String(organization.name ?? "Organization");
    const executionId = await this.runtime.start({
      blueprintId,
      executionType: "organization",
      action: `Orchestrate: ${name}`,
      payload: organization,
    });

    try {
      await this.runtime.updateStatus(executionId, "running", 25);

      const coordination = executionCoordinator.coordinate({
        blueprintId,
        projects: ((organization.projects as Array<Record<string, unknown>>) ?? []).map((p) => ({
          id: String(p.id ?? ""),
          name: String(p.name ?? "Project"),
          ownerId: p.ownerId != null ? String(p.ownerId) : undefined,
          status: p.status != null ? String(p.status) : undefined,
        })),
        execution: organization.execution as Record<string, unknown> | undefined,
        signals: organization.signals as { global?: string } | undefined,
        strategy: organization.strategy as { accelerate?: boolean } | undefined,
      });

      await this.runtime.updateStatus(executionId, "running", 80);

      await this.runtime.complete(executionId, true, "Organization orchestration complete", {
        coordination,
      });

      return { success: true, executionId, coordination };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runtime.complete(executionId, false, `Organization failed: ${message}`, {
        error: message,
      });
      throw err;
    }
  }
}

export const organizationOrchestrator = new OrganizationOrchestrator();
