import { db, blueprints, users } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getEnvironment } from "../config/environments.js";
import {
  getTierLimits,
  pricingTierFromUserTier,
  type PricingTier,
  type UserTier,
} from "../pricing/bhudhiTiers.js";

export interface LimitCheckResult {
  allowed: boolean;
  tier: PricingTier;
  userTier: UserTier;
  limit: number;
  current: number;
  reason?: string;
}

export class LaunchLimitsService {
  async getUserTier(userId: string): Promise<UserTier> {
    const [row] = await db
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return (row?.tier ?? "starter") as UserTier;
  }

  async countBlueprints(userId: string): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, userId), isNull(blueprints.abandoned_at)));
    return Number(row?.c ?? 0);
  }

  async checkBlueprintLimit(userId: string): Promise<LimitCheckResult> {
    const env = getEnvironment();
    const userTier = await this.getUserTier(userId);
    const pricingTier = pricingTierFromUserTier(userTier);
    const tierLimit = getTierLimits(pricingTier).blueprints;
    const envLimit = env.limits.blueprintsPerUser;
    const limit = Math.min(tierLimit, envLimit);
    const current = await this.countBlueprints(userId);

    if (current >= limit) {
      return {
        allowed: false,
        tier: pricingTier,
        userTier,
        limit,
        current,
        reason: `Blueprint limit reached (${current}/${limit}) for ${pricingTier} tier`,
      };
    }

    return { allowed: true, tier: pricingTier, userTier, limit, current };
  }
}

export const launchLimitsService = new LaunchLimitsService();
