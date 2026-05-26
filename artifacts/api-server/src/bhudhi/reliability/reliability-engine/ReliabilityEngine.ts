import { randomUUID } from "node:crypto";
import { reliabilityPolicy } from "../policy/ReliabilityPolicy.js";
import { failureDetector } from "../fault-detection/FailureDetector.js";
import { chaosEngine } from "../chaos/ChaosEngine.js";
import { containmentEngine } from "../containment/ContainmentEngine.js";
import { rollbackEngine } from "../rollback/RollbackEngine.js";
import { recoveryEngine } from "../recovery/RecoveryEngine.js";
import { resilienceEngine } from "../resilience/ResilienceEngine.js";
import { continuityEngine } from "../continuity/ContinuityEngine.js";
import { reliabilityObservatory } from "../observability/ReliabilityObservatory.js";
import { reliabilityMemory } from "../reliability-memory/ReliabilityMemory.js";
import { incidentCommander } from "../incidents/IncidentCommander.js";
import {
  persistReliabilityCheck,
  persistIncident,
  persistRollback,
  persistRecovery,
  listReliabilityHistory,
} from "../reliabilityData.js";
import type {
  ReliabilityInput,
  ReliabilityOutput,
  RollbackMode,
  RollbackTarget,
  RecoveryOutput,
  RollbackResult,
  IncidentRecord,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BRE — failure never becomes collapse. Assume failure exists.
 */
export class ReliabilityEngine {
  async check(input: ReliabilityInput): Promise<ReliabilityOutput> {
    return this.runCycle(input);
  }

  async recover(input: ReliabilityInput): Promise<RecoveryOutput> {
    const policy = reliabilityPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Reliability policy violation: ${policy.violations.join("; ")}`);
    }
    const incidents = failureDetector.detect(input);
    const recovery = recoveryEngine.recover(input, incidents);
    try {
      await persistRecovery(input.blueprintId, recovery);
    } catch (err) {
      logger.warn({ err }, "[ReliabilityEngine] recovery persist skipped");
    }
    return recovery;
  }

  async rollback(
    input: ReliabilityInput,
    target: RollbackTarget,
    mode?: RollbackMode,
  ): Promise<RollbackResult> {
    const policy = reliabilityPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Reliability policy violation: ${policy.violations.join("; ")}`);
    }
    const result = rollbackEngine.rollback(input, target, mode ?? rollbackEngine.suggestMode(input));
    try {
      await persistRollback(input.blueprintId, result);
    } catch (err) {
      logger.warn({ err }, "[ReliabilityEngine] rollback persist skipped");
    }
    return result;
  }

  async incident(input: ReliabilityInput): Promise<IncidentRecord> {
    const incidents = failureDetector.detect(input);
    const record = incidentCommander.run(incidents);
    const confidence = incidents[0]?.confidence ?? 0.5;
    try {
      await persistIncident(input.blueprintId, record, confidence);
    } catch (err) {
      logger.warn({ err }, "[ReliabilityEngine] incident persist skipped");
    }
    return record;
  }

  async health(input: ReliabilityInput): Promise<ReliabilityOutput> {
    const cached = reliabilityMemory.get(input.blueprintId);
    if (cached) return cached;
    return this.runCycle(input);
  }

  async history(blueprintId: string, limit?: number) {
    return listReliabilityHistory(blueprintId, limit);
  }

  formatReliabilityContext(output: ReliabilityOutput): string {
    return [
      `Reliability: health ${Math.round(output.health * 100)}%`,
      `Risk ${Math.round(output.risk * 100)}% · P(fail) ${Math.round(output.failureProbability * 100)}%`,
      output.resilienceScore != null ? `Resilience ${output.resilienceScore}/100` : "",
      output.continuityMode ? `Continuity: ${output.continuityMode}` : "",
      `Protect: ${output.recommendedProtection.slice(0, 80)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** No execution without reliability evaluation. */
  async validateBeforeExecution(
    input: ReliabilityInput,
  ): Promise<{ allowed: boolean; reason?: string; output?: ReliabilityOutput }> {
    const output = await this.runCycle(input);
    const blocked = containmentEngine.shouldBlock(output.containment ?? []);
    const continuity = output.continuityMode;

    if (blocked || continuity === "OFFLINE") {
      return {
        allowed: false,
        reason:
          output.recommendedProtection ||
          "Reliability containment — execution frozen until recovery",
        output,
      };
    }

    if (output.failureProbability > 0.85 && output.risk > 0.7) {
      return {
        allowed: false,
        reason: "Failure probability and risk exceed safe execution threshold",
        output,
      };
    }

    return { allowed: true, output };
  }

  private async runCycle(input: ReliabilityInput): Promise<ReliabilityOutput> {
    const sessionId = randomUUID();

    const policy = reliabilityPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Reliability policy violation: ${policy.violations.join("; ")}`);
    }

    const incidents = failureDetector.detect(input);
    const containment = containmentEngine.contain(incidents);
    const resilience = resilienceEngine.score(input, incidents);
    const continuity = continuityEngine.evaluate(input, incidents);
    const recovery = recoveryEngine.recover(input, incidents);
    void recovery;
    void chaosEngine.supported();

    const severity = failureDetector.topSeverity(incidents);
    const riskMap: Record<string, number> = {
      INFO: 0.1,
      WARNING: 0.25,
      MAJOR: 0.5,
      CRITICAL: 0.75,
      SYSTEM: 0.95,
    };
    const risk = riskMap[severity] ?? 0.3;
    const failureProbability = Math.min(1, risk * 0.7 + resilience.degradation * 0.3);
    const health = Math.max(0, 1 - failureProbability);

    let recommendedProtection = "Continue with standard observability";
    if (containment.some((c) => c.action === "freeze")) {
      recommendedProtection = "Freeze execution — contain before retry";
    } else if (containment.length > 0) {
      recommendedProtection = `Apply ${containment.map((c) => c.action).join(", ")} on ${containment.map((c) => c.target).join(", ")}`;
    } else if (failureProbability > 0.5) {
      recommendedProtection = "Degrade gracefully — throttle non-critical paths";
    }

    const output: ReliabilityOutput = {
      sessionId,
      health,
      risk,
      failureProbability,
      recommendedProtection,
      resilienceScore: resilience.score,
      continuityMode: continuity.mode,
      incidents,
      containment,
    };

    const failurePatterns = incidents.filter((i) => i.incident !== "none").map((i) => i.incident);
    reliabilityMemory.store(input.blueprintId, output, failurePatterns);

    try {
      await persistReliabilityCheck(
        output,
        input.blueprintId,
        resilience.score,
        continuity.mode,
      );
      const incidentRecord = incidentCommander.run(incidents);
      await persistIncident(input.blueprintId, incidentRecord, incidents[0]?.confidence ?? 0.5);
      void reliabilityObservatory.observe(input, incidents.length, 0);
    } catch (err) {
      logger.warn({ err, sessionId }, "[ReliabilityEngine] persist skipped");
    }

    return output;
  }
}

export const reliabilityEngine = new ReliabilityEngine();
