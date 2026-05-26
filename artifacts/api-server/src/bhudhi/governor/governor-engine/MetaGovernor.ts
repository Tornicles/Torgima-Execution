import { randomUUID } from "node:crypto";
import { governorPolicy } from "../policy/GovernorPolicy.js";
import { systemOrchestrator } from "../orchestration/SystemOrchestrator.js";
import { priorityEngine } from "../priority/PriorityEngine.js";
import { arbitrationEngine } from "../arbitration/ArbitrationEngine.js";
import { allocationGovernor } from "../allocation/AllocationGovernor.js";
import { interruptionEngine } from "../interruption/InterruptionEngine.js";
import { recoveryGovernor } from "../recovery/RecoveryGovernor.js";
import { supervisor } from "../supervision/Supervisor.js";
import { governorOptimization } from "../optimization/GovernorOptimization.js";
import { governorMemory } from "../governor-memory/GovernorMemory.js";
import {
  persistGovernorSession,
  persistRecovery,
  listGovernorHistory,
  getLatestHealth,
} from "../governorData.js";
import type {
  ExecutionPlan,
  GovernorInput,
  GovernorOutput,
  RecoveryMode,
  RecoveryResult,
  SystemHealth,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BMGE — operating brain above Bhudhi. Governs intelligence; never replaces it.
 */
export class MetaGovernor {
  async observe(input: GovernorInput): Promise<GovernorOutput> {
    return this.runCycle(input);
  }

  async prioritize(input: GovernorInput): Promise<GovernorOutput["priorityMap"]> {
    const full = await this.runCycle(input);
    return full.priorityMap;
  }

  async allocate(input: GovernorInput): Promise<GovernorOutput["allocation"]> {
    const full = await this.runCycle(input);
    return full.allocation;
  }

  async recover(
    input: GovernorInput,
    target: "execution" | "memory" | "simulation" | "identity" | "organization",
    mode?: RecoveryMode,
  ): Promise<RecoveryResult> {
    const policy = governorPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Governor policy violation: ${policy.violations.join("; ")}`);
    }

    const recovery = recoveryGovernor.recover(
      input,
      target,
      mode ?? recoveryGovernor.suggestMode(input),
    );

    try {
      await persistRecovery(input.blueprintId, recovery);
    } catch (err) {
      logger.warn({ err }, "[MetaGovernor] recovery persist skipped");
    }

    return recovery;
  }

  async health(input: GovernorInput): Promise<SystemHealth> {
    const cached = governorMemory.get(input.blueprintId);
    if (cached?.health) return cached.health;

    const started = Date.now();
    const health = supervisor.assess(input, Date.now() - started);
    return health;
  }

  async history(blueprintId: string, limit?: number) {
    return listGovernorHistory(blueprintId, limit);
  }

  formatGovernorContext(output: GovernorOutput): string {
    const top = output.priorityMap.topPriority;
    return [
      `Governor: ${top.subsystem} is ${top.priority}`,
      `Plan: ${output.executionPlan.note}`,
      output.interventions.length
        ? `Interventions: ${output.interventions.map((i) => i.type).join(", ")}`
        : "",
      output.health ? `System: ${output.health.systemHealth}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Gate before constitutional governance — meta governor coordinates, does not execute. */
  async validateBeforeGovernance(
    input: GovernorInput,
  ): Promise<{ allowed: boolean; reason?: string; output?: GovernorOutput }> {
    const output = await this.runCycle(input);
    const blocked = interruptionEngine.shouldBlock(output.interventions);
    const verdict = arbitrationEngine.topVerdict(output.arbitration ?? []);

    if (blocked) {
      return {
        allowed: false,
        reason: output.interventions[0]?.reason ?? "Meta governor intervention required",
        output,
      };
    }

    if (verdict === "escalate") {
      return {
        allowed: true,
        reason: "Escalated to governance — proceed with approval chain",
        output,
      };
    }

    if (verdict === "delay") {
      return {
        allowed: false,
        reason: "Conflict resolution: delay until arbitration clears",
        output,
      };
    }

    return { allowed: true, output };
  }

  private async runCycle(input: GovernorInput): Promise<GovernorOutput> {
    const sessionId = randomUUID();
    const started = Date.now();

    const policy = governorPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Governor policy violation: ${policy.violations.join("; ")}`);
    }

    const priorityMap = priorityEngine.buildMap(input);
    const arbitration = arbitrationEngine.resolve(input);
    const allocation = allocationGovernor.allocate(input, priorityMap);
    const interventions = interruptionEngine.detect(input);
    const health = supervisor.assess(input, Date.now() - started);
    const optimizations = governorOptimization.recommend(input, health, allocation);

    const orchestration = systemOrchestrator.coordinate(input, priorityMap, interventions);

    const blocked = Object.entries(orchestration)
      .filter(([, a]) => a === "pause" || a === "terminate")
      .map(([s]) => s);

    const escalations = (arbitration ?? [])
      .filter((a) => a.verdict === "escalate")
      .map((a) => a.conflict);

    const executionPlan: ExecutionPlan = {
      sequence: priorityMap.entries
        .filter((e) => !blocked.includes(e.subsystem))
        .map((e) => e.subsystem),
      blocked,
      escalations,
      note: [
        `Top: ${priorityMap.topPriority.subsystem} (${priorityMap.topPriority.priority})`,
        ...optimizations.slice(0, 2),
      ].join(" · "),
    };

    const output: GovernorOutput = {
      sessionId,
      priorityMap,
      allocation,
      interventions,
      executionPlan,
      health,
      arbitration,
    };

    governorMemory.store(input.blueprintId, output);

    try {
      await persistGovernorSession(output, { blueprintId: input.blueprintId }, health);
      void orchestration;
    } catch (err) {
      logger.warn({ err, sessionId }, "[MetaGovernor] persist skipped");
    }

    return output;
  }
}

export const metaGovernor = new MetaGovernor();
