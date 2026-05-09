import { logger } from "../../lib/logger.js";
import type { EnforcementPackage } from "../../types/enforcement.js";

/**
 * EnforcementPackageGenerator — Serializes the ControlEngine output into
 * a concrete enforcement package that can be stored and consumed by
 * TaskGenerationEngine.
 *
 * TODO (Prompt 8): Implement serialization and storage
 */
export class EnforcementPackageGenerator {
  generate(partial: Partial<EnforcementPackage>): EnforcementPackage {
    logger.info("EnforcementPackageGenerator.generate — TODO");
    return {
      blueprintId: partial.blueprintId ?? "",
      userId: partial.userId ?? "",
      condition: partial.condition ?? "building",
      allowedTaskTypes: partial.allowedTaskTypes ?? [],
      blockedTaskTypes: partial.blockedTaskTypes ?? [],
      maxDailyTasks: partial.maxDailyTasks ?? 3,
      focusDomain: partial.focusDomain ?? null,
      overrideReason: partial.overrideReason ?? null,
      generatedAt: new Date().toISOString(),
    };
  }
}
