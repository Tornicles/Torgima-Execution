import { db, blueprintMembers, blueprintTierMigrations, blueprints } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { hydrateBlueprintInfrastructure, invalidateHydrationCache } from "../engines/blueprint/infrastructure/StateHydrationService.js";
import { migrateBlueprintTier } from "../engines/blueprint/infrastructure/TierMigrationEngine.js";
import { getClientFeatureManifest } from "../engines/blueprint/infrastructure/BlueprintTypeRegistry.js";
import { parseMode, parseTier } from "../engines/blueprint/BlueprintRuleEngine.js";
import type { TeamRole } from "../engines/blueprint/infrastructure/blueprint-types.js";
import { getRolePermissions } from "../engines/blueprint/infrastructure/TeamRoleSystem.js";

export const BlueprintInfrastructureService = {
  async getInfrastructureView(blueprintId: string, userId: string) {
    return hydrateBlueprintInfrastructure(blueprintId, userId);
  },

  async migrateTier(blueprintId: string, userId: string, targetTier: "growth" | "ultimate") {
    const result = await migrateBlueprintTier({ blueprintId, userId, targetTier });
    invalidateHydrationCache(blueprintId);
    return result;
  },

  async upsertMember(params: {
    blueprintId: string;
    userId: string;
    memberUserId: string;
    role: TeamRole;
    domain?: string;
  }) {
    const [bp] = await db
      .select({ mode: blueprints.mode })
      .from(blueprints)
      .where(and(eq(blueprints.id, params.blueprintId), eq(blueprints.user_id, params.userId)))
      .limit(1);
    if (!bp || bp.mode !== "team") {
      throw new Error("Team members only for team mode blueprints");
    }

    const existing = await db
      .select({ id: blueprintMembers.id })
      .from(blueprintMembers)
      .where(
        and(
          eq(blueprintMembers.blueprint_id, params.blueprintId),
          eq(blueprintMembers.user_id, params.memberUserId),
        ),
      )
      .limit(1);

    const [row] =
      existing[0] ?
        await db
          .update(blueprintMembers)
          .set({ role: params.role, domain: params.domain ?? null, active: true })
          .where(eq(blueprintMembers.id, existing[0].id))
          .returning()
      : await db
          .insert(blueprintMembers)
          .values({
            blueprint_id: params.blueprintId,
            user_id: params.memberUserId,
            role: params.role,
            domain: params.domain ?? null,
            invited_by: params.userId,
            active: true,
          })
          .returning();

    invalidateHydrationCache(params.blueprintId);
    return { member: row, permissions: getRolePermissions(params.role) };
  },

  async listMembers(blueprintId: string, userId: string) {
    const [bp] = await db
      .select({ id: blueprints.id, tier: blueprints.tier, mode: blueprints.mode })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    if (!bp) return null;

    const members = await db
      .select()
      .from(blueprintMembers)
      .where(eq(blueprintMembers.blueprint_id, blueprintId));

    return {
      tier: parseTier(bp.tier),
      mode: parseMode(bp.mode),
      featureManifest: getClientFeatureManifest(parseTier(bp.tier), parseMode(bp.mode)),
      members: members.map((m) => ({
        ...m,
        permissions: getRolePermissions(m.role as TeamRole),
      })),
    };
  },

  async listTierMigrations(blueprintId: string, userId: string) {
    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
      .limit(1);
    if (!bp) return [];

    return db
      .select()
      .from(blueprintTierMigrations)
      .where(eq(blueprintTierMigrations.blueprint_id, blueprintId))
      .orderBy(desc(blueprintTierMigrations.created_at));
  },
};
