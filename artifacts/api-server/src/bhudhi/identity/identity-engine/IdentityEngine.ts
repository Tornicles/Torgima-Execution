import { randomUUID } from "node:crypto";
import { identityPolicy } from "../policy/IdentityPolicy.js";
import { identityGraph } from "../profile/IdentityGraph.js";
import { valueEngine } from "../values/ValueEngine.js";
import { motivationEngine } from "../motivation/MotivationEngine.js";
import { capabilityEngine } from "../capability/CapabilityEngine.js";
import { personalityEngine } from "../personality/PersonalityEngine.js";
import { growthEngine } from "../growth/GrowthEngine.js";
import { identityAdaptation } from "../adaptation/IdentityAdaptation.js";
import { identityDrift } from "../drift/IdentityDrift.js";
import { identityMemory } from "../identity-memory/IdentityMemory.js";
import { persistIdentitySession, listIdentityHistory, getIdentityProfile, listIdentityValues } from "../identityData.js";
import type { IdentityInput, IdentityOutput } from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BIIE — identity is the highest personalization layer. Cannot override governance.
 */
export class IdentityEngine {
  async process(input: IdentityInput): Promise<IdentityOutput> {
    const sessionId = randomUUID();
    const profileId = randomUUID();

    const policy = identityPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Identity policy violation: ${policy.violations.join("; ")}`);
    }

    const graph = identityGraph.build(input);
    const values = valueEngine.assess(input);
    const motivations = motivationEngine.detect(input);
    const capabilities = capabilityEngine.score(input);
    const personality = personalityEngine.dimensions(input);
    const executionProfile = personalityEngine.executionProfile(personality);

    const maturity = Math.min(
      1,
      capabilities.capabilityScore * 0.5 + motivations.stability * 0.3 + 0.2,
    );
    const stability = motivations.stability * 0.6 + (1 - (values.conflicts.length * 0.15)) * 0.4;
    const growthDirection = growthEngine.assess(input, maturity, stability);

    const adaptations = identityAdaptation.adapt(input, executionProfile, motivations, personality);
    const drift = identityDrift.detect(input, values);

    if (drift.action === "pause" || drift.action === "escalate") {
      adaptations.execution = `BLOCKED — identity drift (${drift.signals.join(", ")})`;
    }

    const identityState = {
      profileId,
      executionProfile,
      stage: growthDirection.currentState,
      maturity,
    };

    const output: IdentityOutput = {
      sessionId,
      identityState,
      values,
      motivations,
      capabilities,
      growthDirection,
      personality,
      graph,
      adaptations,
      drift,
    };

    identityMemory.store(input.blueprintId, output);

    try {
      await persistIdentitySession(output, {
        blueprintId: input.blueprintId,
        userId: input.userId,
      });
    } catch (err) {
      logger.warn({ err, sessionId }, "[IdentityEngine] persist skipped");
    }

    return output;
  }

  formatIdentityContext(output: IdentityOutput): string {
    return [
      `Identity ${output.identityState.executionProfile} (${output.identityState.stage})`,
      `Values: ${output.values.rankedValues
        .slice(0, 3)
        .map((v) => v.key)
        .join(", ")}`,
      `Motivation: ${output.motivations.motivationType} (${Math.round(output.motivations.stability * 100)}% stable)`,
      `Growth → ${output.growthDirection.nextIdentity}`,
      output.values.protectionRules[0] ?? "",
      output.drift?.detected ? `Drift: ${output.drift.action}` : "",
      output.adaptations?.communication ? `Tone: ${output.adaptations.communication}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Execution cannot destroy protected values. */
  validateExecutionAgainstValues(action: string, output: IdentityOutput): { allowed: boolean; reason?: string } {
    if (valueEngine.wouldViolateProtected(action, output.values)) {
      return { allowed: false, reason: "Would violate protected values" };
    }
    if (output.drift?.action === "pause" || output.drift?.action === "escalate") {
      return { allowed: false, reason: `Identity drift: ${output.drift.signals.join(", ")}` };
    }
    return { allowed: true };
  }

  async profile(blueprintId: string) {
    const cached = identityMemory.get(blueprintId);
    if (cached) return cached;
    const history = await listIdentityHistory(blueprintId, 1);
    if (history.length === 0) return null;
    const row = await getIdentityProfile(history[0]!.profileId);
    if (!row) return null;
    const values = await listIdentityValues(row.id);
    return {
      profileId: row.id,
      executionProfile: row.execution_profile,
      values,
      growthDirection: row.growth_direction,
      confidence: row.confidence,
    };
  }

  async growth(blueprintId: string) {
    const cached = identityMemory.get(blueprintId);
    if (cached) return cached.growthDirection;
    return growthEngine.assess({ blueprintId }, 0.5, 0.5);
  }

  async adapt(blueprintId: string, input?: Partial<IdentityInput>) {
    const base = identityMemory.get(blueprintId);
    if (base?.adaptations) return base.adaptations;
    const full = await this.process({ blueprintId, ...input });
    return full.adaptations;
  }

  async values(blueprintId: string) {
    const cached = identityMemory.get(blueprintId);
    if (cached) return cached.values;
    return valueEngine.assess({ blueprintId });
  }

  async history(blueprintId: string, limit?: number) {
    return listIdentityHistory(blueprintId, limit);
  }

  async driftCheck(blueprintId: string, input?: Partial<IdentityInput>) {
    const values = valueEngine.assess({ blueprintId, ...input });
    return identityDrift.detect({ blueprintId, ...input }, values);
  }
}

export const identityEngine = new IdentityEngine();
