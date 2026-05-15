import type { BlueprintMode, BlueprintTier } from "./blueprint-types.js";
import { getBlueprintTypeConfig } from "./BlueprintTypeRegistry.js";
import type { TeamRole } from "./blueprint-types.js";

export interface TargetDistributionInput {
  targetId: string;
  name: string;
  type: string;
  strategicWeight: number;
  ownerId: string;
  memberIds: Array<{ userId: string; role: TeamRole; capabilityLevel?: string }>;
}

export interface DistributedTarget {
  targetId: string;
  ownerId: string;
  contributorIds: string[];
  executionWeight: number;
  coordinationRequired: boolean;
  dependencyTargets: string[];
  roleDomain: string | null;
}

export function distributeTargets(
  tier: BlueprintTier,
  mode: BlueprintMode,
  targets: TargetDistributionInput[],
): DistributedTarget[] {
  const cfg = getBlueprintTypeConfig(tier);
  if (mode !== "team" || cfg.allowedTeamCoordination.length === 0) {
    return targets.map((t) => ({
      targetId: t.targetId,
      ownerId: t.ownerId,
      contributorIds: [],
      executionWeight: 1,
      coordinationRequired: false,
      dependencyTargets: [],
      roleDomain: null,
    }));
  }

  const totalWeight = targets.reduce((s, t) => s + t.strategicWeight, 0) || 1;
  const members = targets[0]?.memberIds ?? [];

  return targets.map((t, index) => {
    const share = t.strategicWeight / totalWeight;
    const contributors = members
      .filter((m) => m.userId !== t.ownerId && m.role !== "observer")
      .slice(0, Math.max(1, Math.ceil(members.length * share)))
      .map((m) => m.userId);

    return {
      targetId: t.targetId,
      ownerId: t.ownerId,
      contributorIds: contributors,
      executionWeight: Math.round(share * 100) / 100,
      coordinationRequired: contributors.length > 0,
      dependencyTargets: index > 0 ? [targets[index - 1]!.targetId] : [],
      roleDomain: members.find((m) => m.userId === t.ownerId)?.role ?? "operator",
    };
  });
}
