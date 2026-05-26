import { randomUUID } from "node:crypto";
import { infrastructurePolicy } from "../policy/InfrastructurePolicy.js";
import { runtimeEngine } from "../runtime/RuntimeEngine.js";
import { deploymentEngine } from "../deployment/DeploymentEngine.js";
import { scalingEngine } from "../scaling/ScalingEngine.js";
import { resourceAllocator } from "../allocation/ResourceAllocator.js";
import { infrastructureObservatory } from "../observability/InfrastructureObservatory.js";
import { tenancyEngine } from "../tenancy/TenancyEngine.js";
import { edgeEngine } from "../edge/EdgeEngine.js";
import { infrastructureRecovery } from "../recovery/InfrastructureRecovery.js";
import { infrastructureMemory } from "../infrastructure-memory/InfrastructureMemory.js";
import {
  persistInfrastructureObserve,
  persistRecovery,
  listInfrastructureHistory,
} from "../infrastructureData.js";
import type {
  DeploymentStrategy,
  InfrastructureInput,
  InfrastructureOutput,
  RecoveryResult,
  RuntimeResult,
  ScaleResult,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BIIE — compute as part of reality. No execution without infrastructure awareness.
 */
export class InfrastructureEngine {
  async observe(input: InfrastructureInput): Promise<InfrastructureOutput> {
    return this.runCycle(input);
  }

  async runtime(input: InfrastructureInput): Promise<RuntimeResult> {
    const full = await this.runCycle(input);
    return full.runtime ?? runtimeEngine.observe(input);
  }

  async deploy(input: InfrastructureInput, strategy?: DeploymentStrategy) {
    const full = await this.runCycle(input);
    if (strategy) {
      full.deploymentPlan.strategy = strategy;
    }
    return full.deploymentPlan;
  }

  async scale(input: InfrastructureInput): Promise<ScaleResult> {
    const full = await this.runCycle(input);
    return full.scale ?? scalingEngine.forecast(input, full.capacity.utilization);
  }

  async recover(
    input: InfrastructureInput,
    target: "runtime" | "deployment" | "storage" | "network",
  ): Promise<RecoveryResult> {
    const policy = infrastructurePolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Infrastructure policy violation: ${policy.violations.join("; ")}`);
    }
    const recovery = infrastructureRecovery.recover(input, target);
    try {
      await persistRecovery(input.blueprintId, recovery);
    } catch (err) {
      logger.warn({ err }, "[InfrastructureEngine] recovery persist skipped");
    }
    return recovery;
  }

  async history(blueprintId: string, limit?: number) {
    return listInfrastructureHistory(blueprintId, limit);
  }

  formatInfrastructureContext(output: InfrastructureOutput): string {
    return [
      `Infra: ${output.environment}`,
      `Capacity ${Math.round(output.capacity.utilization * 100)}% (${output.capacity.canSupport ? "OK" : "constrained"})`,
      output.runtime ? `Runtime ${output.runtime.runtime} health ${Math.round(output.runtime.health * 100)}%` : "",
      `Deploy: ${output.deploymentPlan.strategy} (rollback ${output.deploymentPlan.rollbackAvailable ? "yes" : "no"})`,
      output.scale ? `Scale ${output.scale.scale} · cost ~${output.scale.cost.toFixed(2)}` : "",
      `Risk ${Math.round(output.risk * 100)}%`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async validateBeforeExecution(
    input: InfrastructureInput,
  ): Promise<{ allowed: boolean; reason?: string; output?: InfrastructureOutput }> {
    const output = await this.runCycle(input);

    if (!output.capacity.canSupport) {
      return {
        allowed: false,
        reason: "Infrastructure cannot support execution — scale or allocate before run",
        output,
      };
    }

    if (output.risk > 0.85) {
      return {
        allowed: false,
        reason: output.deploymentPlan.recommendation,
        output,
      };
    }

    const tenancy = tenancyEngine.evaluate(input);
    if (tenancy.violations.length > 0) {
      return {
        allowed: false,
        reason: tenancy.violations[0],
        output,
      };
    }

    if ((output.runtime?.health ?? 1) < 0.35) {
      return {
        allowed: false,
        reason: "Runtime health too low — recover before execution",
        output,
      };
    }

    return { allowed: true, output };
  }

  private async runCycle(input: InfrastructureInput): Promise<InfrastructureOutput> {
    const sessionId = randomUUID();

    const policy = infrastructurePolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Infrastructure policy violation: ${policy.violations.join("; ")}`);
    }

    const runtime = runtimeEngine.observe(input);
    const alloc = resourceAllocator.allocate(input);
    const capacity = resourceAllocator.capacityFromAllocation(alloc);
    const scale = scalingEngine.forecast(input, capacity.utilization);
    const risk = Math.min(
      1,
      (1 - runtime.health) * 0.4 + capacity.utilization * 0.35 + (input.security?.risk as number ?? 0) * 0.25,
    );
    const deploymentPlan = deploymentEngine.plan(input, risk);
    const observability = infrastructureObservatory.observe(input, runtime.health);
    const edge = edgeEngine.route(input);
    const tenancy = tenancyEngine.evaluate(input);
    void edge;
    void tenancy;

    const environment = `${runtime.runtime}-${edge.mode}`.toLowerCase();

    const output: InfrastructureOutput = {
      sessionId,
      environment,
      capacity,
      risk,
      deploymentPlan,
      runtime,
      scale,
    };

    infrastructureMemory.store(input.blueprintId, output);

    try {
      await persistInfrastructureObserve(output, input.blueprintId, alloc, observability);
    } catch (err) {
      logger.warn({ err, sessionId }, "[InfrastructureEngine] persist skipped");
    }

    return output;
  }
}

export const infrastructureEngine = new InfrastructureEngine();
