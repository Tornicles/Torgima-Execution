import type { BlueprintTier } from "./blueprint-types.js";

const TIER_LINK_CAPS: Record<BlueprintTier, number> = {
  starter: 1,
  growth: 2,
  ultimate: 3,
};

export interface KnowledgeLinkCandidate {
  id: string;
  priority?: number | null;
}

export function maxKnowledgeLinksForTier(tier: BlueprintTier): number {
  return TIER_LINK_CAPS[tier];
}

export function selectKnowledgeLinksForOrder<T extends KnowledgeLinkCandidate>(
  objects: T[],
  tier: BlueprintTier,
): T[] {
  const cap = maxKnowledgeLinksForTier(tier);
  return [...objects]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, cap);
}

export function canAttachKnowledgeAtGeneration(tier: BlueprintTier): boolean {
  return tier !== "starter" || maxKnowledgeLinksForTier(tier) > 0;
}
