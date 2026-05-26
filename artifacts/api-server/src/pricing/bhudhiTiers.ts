/** Bhudhi launch pricing tiers (Prompt 40). Mapped to Torgima user_tier in Postgres. */

export type PricingTier = "free" | "pro" | "enterprise";
export type UserTier = "starter" | "growth" | "ultimate";

export interface TierLimits {
  blueprints: number;
  tasks: number;
  monthlyExecutions: number;
  storageGB: number;
  apiRequests: number;
  customFrameworks: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  sso: boolean;
  dedicatedInfra: boolean;
}

export const pricingTiers: Record<
  PricingTier,
  {
    name: string;
    monthlyPrice: number;
    limits: TierLimits;
    description: string;
    torgimaTier: UserTier;
  }
> = {
  free: {
    name: "Free",
    monthlyPrice: 0,
    description: "For individuals getting started",
    torgimaTier: "starter",
    limits: {
      blueprints: 1,
      tasks: 50,
      monthlyExecutions: 100,
      storageGB: 1,
      apiRequests: 1000,
      customFrameworks: false,
      prioritySupport: false,
      advancedAnalytics: false,
      sso: false,
      dedicatedInfra: false,
    },
  },

  pro: {
    name: "Pro",
    monthlyPrice: 99,
    description: "For teams and growing businesses",
    torgimaTier: "growth",
    limits: {
      blueprints: 10,
      tasks: 500,
      monthlyExecutions: 10000,
      storageGB: 100,
      apiRequests: 100000,
      customFrameworks: true,
      prioritySupport: true,
      advancedAnalytics: true,
      sso: false,
      dedicatedInfra: false,
    },
  },

  enterprise: {
    name: "Enterprise",
    monthlyPrice: 999,
    description: "For large-scale operations",
    torgimaTier: "ultimate",
    limits: {
      blueprints: 100,
      tasks: 10000,
      monthlyExecutions: 1000000,
      storageGB: 1000,
      apiRequests: 10000000,
      customFrameworks: true,
      prioritySupport: true,
      advancedAnalytics: true,
      sso: true,
      dedicatedInfra: true,
    },
  },
};

export function getTierLimits(tier: PricingTier): TierLimits {
  return pricingTiers[tier].limits;
}

export function pricingTierFromUserTier(userTier: UserTier): PricingTier {
  switch (userTier) {
    case "growth":
      return "pro";
    case "ultimate":
      return "enterprise";
    default:
      return "free";
  }
}

export function userTierFromPricingTier(tier: PricingTier): UserTier {
  return pricingTiers[tier].torgimaTier;
}
