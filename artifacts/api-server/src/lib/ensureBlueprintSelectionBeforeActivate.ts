import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { parseMode, parseTier } from "../engines/blueprint/BlueprintRuleEngine.js";
import type { BlueprintTier } from "../engines/blueprint/infrastructure/blueprint-types.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import { logger } from "./logger.js";

export type EnsureBlueprintSelectionOptions = {
  tier?: BlueprintTier;
  mode?: "individual" | "team";
};

/**
 * Ensures tier, mode, and selection_confirmed_at are set before BlueprintEngine.activateBlueprint.
 * Idempotent — safe to call when selection was already configured via the launch flow.
 */
export async function ensureBlueprintSelectionBeforeActivate(
  blueprintId: string,
  userId: string,
  options: EnsureBlueprintSelectionOptions = {},
): Promise<void> {
  const bp = await BlueprintRepository.findById(blueprintId, userId);
  const tier = parseTier(
    options.tier ?? bp.tier ?? bp.selected_blueprint_level ?? bp.blueprint_tier ?? "growth",
  );
  const mode = parseMode(options.mode ?? bp.mode ?? "individual");

  if (bp.tier && bp.mode && bp.selection_confirmed_at) {
    return;
  }

  logger.info(
    { blueprintId, tier, mode, hadTier: Boolean(bp.tier), hadMode: Boolean(bp.mode) },
    "ensureBlueprintSelectionBeforeActivate — configuring tier and mode",
  );

  const engine = new BlueprintEngine();
  await engine.configureSelection(blueprintId, userId, { tier, mode });
}
