import { logger } from "../../lib/logger.js";
import type { Blueprint } from "../../types/blueprint.js";

/**
 * BlueprintEngine — Manages blueprint lifecycle:
 * - Structuring raw goals into phased blueprints
 * - Phase advancement logic
 * - Completion detection
 * - Pivot evaluation
 *
 * TODO (Prompt 4): Implement full blueprint lifecycle
 */
export class BlueprintEngine {
  async structureGoal(rawGoal: string, domain: string | null): Promise<Partial<Blueprint>> {
    logger.info({ rawGoal }, "BlueprintEngine.structureGoal — TODO");
    // TODO: Call BhudhiCore with BLUEPRINT_GENERATION trigger
    return {
      title: rawGoal.slice(0, 80),
      rawGoal,
      domain: domain ?? "genesis",
      status: "draft",
      phase: 1,
      totalPhases: 4,
    };
  }

  async advancePhase(blueprint: Blueprint): Promise<Blueprint> {
    logger.info({ blueprintId: blueprint.id }, "BlueprintEngine.advancePhase — TODO");
    return { ...blueprint, phase: blueprint.phase + 1 };
  }

  isComplete(blueprint: Blueprint): boolean {
    return blueprint.phase >= blueprint.totalPhases;
  }
}
