import { db, blueprints, blueprintTierMigrations, targets, seasons } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TorgimaError } from "../../../lib/errors.js";
import type { BlueprintTier } from "./blueprint-types.js";
import {
  getBlueprintTypeConfig,
  GROWTH_BLUEPRINT_CONFIG,
  ULTIMATE_BLUEPRINT_CONFIG,
} from "./BlueprintTypeRegistry.js";
import { getClientFeatureManifest } from "./BlueprintTypeRegistry.js";

const MIGRATION_PATH: Record<string, BlueprintTier | null> = {
  "starter->growth": "growth",
  "growth->ultimate": "ultimate",
};

export async function migrateBlueprintTier(params: {
  blueprintId: string;
  userId: string;
  targetTier: BlueprintTier;
}): Promise<{ fromTier: BlueprintTier; toTier: BlueprintTier; unlockedSystems: string[] }> {
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  if (!bp || bp.user_id !== params.userId) {
    throw new TorgimaError("NOT_FOUND", "Blueprint not found");
  }

  const fromTier = (bp.tier ?? "starter") as BlueprintTier;
  const key = `${fromTier}->${params.targetTier}`;
  if (!MIGRATION_PATH[key]) {
    throw new TorgimaError("VALIDATION_ERROR", `Illegal tier migration: ${fromTier} → ${params.targetTier}`);
  }

  const fromCfg = getBlueprintTypeConfig(fromTier);
  const toCfg = getBlueprintTypeConfig(params.targetTier);
  const unlockedSystems = toCfg.allowedSystems.filter((s) => !fromCfg.allowedSystems.includes(s));

  await db.transaction(async (tx) => {
    await tx
      .update(blueprints)
      .set({
        tier: params.targetTier,
        intelligence_depth: toCfg.intelligenceDepth,
        blueprint_config: {
          ...(bp.blueprint_config as Record<string, unknown>),
          tierMigration: { from: fromTier, to: params.targetTier, unlockedSystems },
          featureManifest: getClientFeatureManifest(params.targetTier, bp.mode ?? "individual"),
        },
      })
      .where(eq(blueprints.id, params.blueprintId));

    if (params.targetTier === "growth" || params.targetTier === "ultimate") {
      const targetCfg = params.targetTier === "growth" ? GROWTH_BLUEPRINT_CONFIG : ULTIMATE_BLUEPRINT_CONFIG;
      const existingTargets = await tx
        .select({ id: targets.id })
        .from(targets)
        .where(eq(targets.blueprint_id, params.blueprintId));

      if (existingTargets.length < targetCfg.targetCount) {
        const toAdd = targetCfg.targetCount - existingTargets.length;
        for (let i = 0; i < toAdd; i++) {
          await tx.insert(targets).values({
            blueprint_id: params.blueprintId,
            owner_id: params.userId,
            name: `Unlocked target ${existingTargets.length + i + 1}`,
            type: "operating",
            order_index: existingTargets.length + i + 1,
            status: "pending",
          });
        }
      }

      if (params.targetTier === "ultimate") {
        const seasonRows = await tx
          .select({ id: seasons.id })
          .from(seasons)
          .where(eq(seasons.blueprint_id, params.blueprintId));
        if (seasonRows.length < ULTIMATE_BLUEPRINT_CONFIG.seasonCount) {
          await tx.insert(seasons).values({
            blueprint_id: params.blueprintId,
            name: "traction",
            order_index: seasonRows.length + 1,
            status: "pending",
          });
        }
      }
    }

    await tx.insert(blueprintTierMigrations).values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      from_tier: fromTier,
      to_tier: params.targetTier,
      unlocked_systems: unlockedSystems,
      migration_snapshot: { fromConfig: fromCfg.tier, toConfig: toCfg.tier },
    });
  });

  return { fromTier, toTier: params.targetTier, unlockedSystems };
}
