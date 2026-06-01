import { logger } from "../../lib/logger.js";
import type { EnforcementPackage } from "../../types/enforcement.js";

/**
 * STUB — not called in production.
 * Live enforcement packages are created by ControlEngine.generateEnforcementPackage().
 * Do not call this class from workers or routes.
 *
 * EnforcementPackageGenerator — legacy placeholder for serialization experiments.
 */
export class EnforcementPackageGenerator {
  generate(partial: Partial<EnforcementPackage>): EnforcementPackage {
    logger.info("EnforcementPackageGenerator.generate — TODO");
    return {
      blueprintId: partial.blueprintId ?? "",
      userId: partial.userId ?? "",
      condition: partial.condition ?? "stability",
      allowedTaskTypes: partial.allowedTaskTypes ?? [],
      blockedTaskTypes: partial.blockedTaskTypes ?? [],
      maxDailyTasks: partial.maxDailyTasks ?? 3,
      focusDomain: partial.focusDomain ?? null,
      overrideReason: partial.overrideReason ?? null,
      generatedAt: new Date().toISOString(),
    };
  }
}
