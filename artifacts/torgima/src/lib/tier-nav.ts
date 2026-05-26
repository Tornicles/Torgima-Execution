import type { BlueprintTierLabel } from "@/lib/feature-gate";
import { GROWTH_SEQUENCE_NUMBER, ULTIMATE_SEQUENCE_NUMBER } from "@/lib/feature-gate";

export type TierNavItem = {
  label: string;
  href: string;
  locked: boolean;
  lockReason?: string;
  group?: "core" | "growth" | "ultimate";
};

export function getTierNav(
  tier: BlueprintTierLabel,
  currentSequence: number,
  completedNumbers: number[] = [],
): TierNavItem[] {
  const growthUnlocked =
    tier !== "Starter" &&
    completedNumbers.includes(23) &&
    !isSeqLocked(24, tier, completedNumbers);
  const ultimateUnlocked =
    tier === "Ultimate" &&
    completedNumbers.includes(24) &&
    !isSeqLocked(25, tier, completedNumbers);

  const items: TierNavItem[] = [
    { label: "Dashboard", href: "/dashboard", locked: false, group: "core" },
    { label: "Orders", href: "/orders", locked: false, group: "core" },
    { label: "Feedback", href: "/feedback", locked: false, group: "core" },
    { label: "Signals", href: "/signals", locked: false, group: "core" },
    { label: "Blueprint", href: "/blueprint", locked: false, group: "core" },
    {
      label: "Growth Intelligence",
      href: "/growth",
      locked: !growthUnlocked,
      lockReason: growthUnlocked ? undefined : "Growth tier + Sequence 24",
      group: "growth",
    },
    {
      label: "Growth: Knowledge",
      href: "/growth/knowledge",
      locked: !growthUnlocked,
      group: "growth",
    },
    {
      label: "Growth: Interrogation",
      href: "/growth/interrogation",
      locked: !growthUnlocked,
      group: "growth",
    },
    {
      label: "Ultimate Intelligence",
      href: "/ultimate",
      locked: !ultimateUnlocked,
      lockReason: ultimateUnlocked ? undefined : "Ultimate tier + Sequence 25",
      group: "ultimate",
    },
    {
      label: "Ultimate: Predictions",
      href: "/ultimate/predictions",
      locked: !ultimateUnlocked,
      group: "ultimate",
    },
    {
      label: "Ultimate: Scene",
      href: "/ultimate/scene",
      locked: !ultimateUnlocked,
      group: "ultimate",
    },
  ];

  void currentSequence;
  return items;
}

function isSeqLocked(seq: number, tier: BlueprintTierLabel, completed: number[]): boolean {
  if (seq === GROWTH_SEQUENCE_NUMBER && tier === "Starter") return true;
  if (seq === ULTIMATE_SEQUENCE_NUMBER && tier !== "Ultimate") return true;
  if (seq === GROWTH_SEQUENCE_NUMBER) return !completed.includes(23);
  if (seq === ULTIMATE_SEQUENCE_NUMBER) return !completed.includes(24);
  return false;
}

export function getUnlockedNav(
  tier: BlueprintTierLabel,
  currentSequence: number,
  completedNumbers: number[] = [],
): TierNavItem[] {
  return getTierNav(tier, currentSequence, completedNumbers).filter((i) => !i.locked);
}
