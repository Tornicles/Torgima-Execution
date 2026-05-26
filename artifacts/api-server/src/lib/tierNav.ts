import type { BlueprintTierLabel } from "../types/sequences.js";
import { GROWTH_SEQUENCE_NUMBER } from "../engines/growth/growthGate.js";
import { ULTIMATE_SEQUENCE_NUMBER } from "../engines/ultimate/ultimateGate.js";
import {
  computeSequenceLocked,
  normalizeBlueprintTier,
} from "../engines/sequence/SequenceTracker.js";

export type TierNavItem = {
  label: string;
  href: string;
  tierRequired?: BlueprintTierLabel;
  seqRequired?: number;
  locked: boolean;
  lockReason?: string;
  group?: "core" | "growth" | "ultimate";
};

function isGrowthNavUnlocked(
  tier: BlueprintTierLabel,
  completedNumbers: number[],
): boolean {
  if (tier === "Starter") return false;
  return !computeSequenceLocked(GROWTH_SEQUENCE_NUMBER, tier, completedNumbers);
}

function isUltimateNavUnlocked(
  tier: BlueprintTierLabel,
  completedNumbers: number[],
): boolean {
  if (tier !== "Ultimate") return false;
  return !computeSequenceLocked(ULTIMATE_SEQUENCE_NUMBER, tier, completedNumbers);
}

export function getTierNavItems(
  tierLabel: string,
  currentSequence: number,
  completedNumbers: number[] = [],
): TierNavItem[] {
  const tier = normalizeBlueprintTier(tierLabel);
  const growthUnlocked = isGrowthNavUnlocked(tier, completedNumbers);
  const ultimateUnlocked = isUltimateNavUnlocked(tier, completedNumbers);

  const growthLockedReason = !growthUnlocked
    ? tier === "Starter"
      ? "Growth tier required"
      : `Unlocks at Sequence ${GROWTH_SEQUENCE_NUMBER}`
    : undefined;

  const ultimateLockedReason = !ultimateUnlocked
    ? tier !== "Ultimate"
      ? "Ultimate tier required"
      : `Unlocks at Sequence ${ULTIMATE_SEQUENCE_NUMBER}`
    : undefined;

  return [
    { label: "Dashboard", href: "/dashboard", locked: false, group: "core" },
    { label: "Blueprint", href: "/blueprint", locked: false, group: "core" },
    { label: "Orders", href: "/orders", locked: false, group: "core" },
    { label: "Feedback", href: "/feedback", locked: false, group: "core" },
    { label: "Signals", href: "/signals", locked: false, group: "core" },
    {
      label: "Growth Intelligence",
      href: "/growth",
      tierRequired: "Growth",
      seqRequired: GROWTH_SEQUENCE_NUMBER,
      locked: !growthUnlocked,
      lockReason: growthLockedReason,
      group: "growth",
    },
    {
      label: "Growth: Knowledge",
      href: "/growth/knowledge",
      tierRequired: "Growth",
      seqRequired: GROWTH_SEQUENCE_NUMBER,
      locked: !growthUnlocked,
      lockReason: growthLockedReason,
      group: "growth",
    },
    {
      label: "Growth: Interrogation",
      href: "/growth/interrogation",
      tierRequired: "Growth",
      seqRequired: GROWTH_SEQUENCE_NUMBER,
      locked: !growthUnlocked,
      lockReason: growthLockedReason,
      group: "growth",
    },
    {
      label: "Growth: Adaptation",
      href: "/growth/adaptation",
      tierRequired: "Growth",
      seqRequired: GROWTH_SEQUENCE_NUMBER,
      locked: !growthUnlocked,
      lockReason: growthLockedReason,
      group: "growth",
    },
    {
      label: "Growth: Patterns",
      href: "/growth/patterns",
      tierRequired: "Growth",
      seqRequired: GROWTH_SEQUENCE_NUMBER,
      locked: !growthUnlocked,
      lockReason: growthLockedReason,
      group: "growth",
    },
    {
      label: "Ultimate Intelligence",
      href: "/ultimate",
      tierRequired: "Ultimate",
      seqRequired: ULTIMATE_SEQUENCE_NUMBER,
      locked: !ultimateUnlocked,
      lockReason: ultimateLockedReason,
      group: "ultimate",
    },
    {
      label: "Ultimate: Predictions",
      href: "/ultimate/predictions",
      tierRequired: "Ultimate",
      seqRequired: ULTIMATE_SEQUENCE_NUMBER,
      locked: !ultimateUnlocked,
      lockReason: ultimateLockedReason,
      group: "ultimate",
    },
    {
      label: "Ultimate: Scene",
      href: "/ultimate/scene",
      tierRequired: "Ultimate",
      seqRequired: ULTIMATE_SEQUENCE_NUMBER,
      locked: !ultimateUnlocked,
      lockReason: ultimateLockedReason,
      group: "ultimate",
    },
  ];
}

export function getUnlockedTierNav(
  tierLabel: string,
  currentSequence: number,
  completedNumbers: number[] = [],
): TierNavItem[] {
  return getTierNavItems(tierLabel, currentSequence, completedNumbers).filter(
    (item) => !item.locked,
  );
}
