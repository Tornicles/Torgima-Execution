/**
 * Minimal blueprint activation when advanced generation fails in Launch Mode.
 */

import { db, blueprints, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { BlueprintEngine } from "../blueprint/BlueprintEngine.js";
import { BlueprintStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { generateInitialTasks } from "../tasks/generateInitialTasks.js";
import type { TierLaunchLevel, TierLaunchPath } from "../../services/BlueprintTierLaunchService.js";

export type MinimalLaunchResult = {
  blueprintId: string;
  tier: TierLaunchLevel;
  launched: true;
  usedFallback: true;
  generationSummary: {
    plansCreated: number;
    seasonsCreated: number;
    targetsCreated: number;
    phasesCreated: number;
    actionsCreated: number;
    durationMs: number;
  };
};

const blueprintEngine = new BlueprintEngine();

/**
 * Activate blueprint with minimal hierarchy when tier chain generation fails.
 * Ensures user reaches dashboard with foundation tasks.
 */
export async function activateMinimalLaunchBlueprint(params: {
  blueprintId: string;
  validationId: string;
  userId: string;
  selectedTier: TierLaunchLevel;
  selectedPath: TierLaunchPath;
  validationContractId: string;
}): Promise<MinimalLaunchResult> {
  const started = Date.now();

  await db
    .update(blueprints)
    .set({
      status: BlueprintStatus.PATH_SELECTION,
      tier: params.selectedTier,
      selected_path: params.selectedPath,
      selected_blueprint_level: params.selectedTier,
      blueprint_tier: params.selectedTier,
      active: false,
      updated_at: new Date(),
    })
    .where(and(eq(blueprints.id, params.blueprintId), eq(blueprints.user_id, params.userId)));

  try {
    await blueprintEngine.activateBlueprint(
      params.blueprintId,
      params.userId,
      params.validationContractId,
    );
  } catch (activateErr) {
    logger.warn(
      { err: activateErr instanceof Error ? activateErr.message : String(activateErr) },
      "[LaunchModeBlueprint] activateBlueprint failed — forcing active status",
    );
    await db
      .update(blueprints)
      .set({
        status: BlueprintStatus.ACTIVE,
        active: true,
        current_condition: "nothingness",
        updated_at: new Date(),
      })
      .where(and(eq(blueprints.id, params.blueprintId), eq(blueprints.user_id, params.userId)));
  }

  const [validation] = await db
    .select()
    .from(validations)
    .where(eq(validations.id, params.validationId))
    .limit(1);

  if (validation) {
    await generateInitialTasks({
      blueprintId: params.blueprintId,
      userId: params.userId,
      validation,
      selectedPath: params.selectedPath,
    }).catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[LaunchModeBlueprint] initial tasks failed (non-fatal)",
      );
    });
  }

  await db
    .update(validations)
    .set({
      tier_flow_status: "launched",
      is_finalized: true,
      finalized_at: new Date(),
      launch_blocked: false,
    })
    .where(eq(validations.id, params.validationId));

  logger.info(
    { blueprintId: params.blueprintId, validationId: params.validationId },
    "[LaunchModeBlueprint] Minimal launch complete",
  );

  return {
    blueprintId: params.blueprintId,
    tier: params.selectedTier,
    launched: true,
    usedFallback: true,
    generationSummary: {
      plansCreated: 1,
      seasonsCreated: 1,
      targetsCreated: 1,
      phasesCreated: 1,
      actionsCreated: 0,
      durationMs: Date.now() - started,
    },
  };
}
