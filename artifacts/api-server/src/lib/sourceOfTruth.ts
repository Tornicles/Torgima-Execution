/**
 * Prompt 8 §5.1 — authoritative source priority (highest wins).
 * Bhudhi and cached projections are never ground truth for system decisions.
 */

export const SOURCE_PRIORITY = [
  "execution_signals",
  "condition_record",
  "signal_snapshot",
  "enforcement_package",
  "eis_intelligence",
  "bhudhi_interpretation",
  "cached_projection",
] as const;

export type SourceKind = (typeof SOURCE_PRIORITY)[number];

export function sourceRank(kind: SourceKind): number {
  const i = SOURCE_PRIORITY.indexOf(kind);
  return i >= 0 ? i : SOURCE_PRIORITY.length;
}

/** True when `winner` has higher authority than `challenger` (lower rank index). */
export function canOverride(winner: SourceKind, challenger: SourceKind): boolean {
  return sourceRank(winner) < sourceRank(challenger);
}

export function assertAuthoritativeSource(kind: SourceKind, context: string): void {
  if (kind === "bhudhi_interpretation" || kind === "cached_projection") {
    throw new Error(
      `[SourceOfTruth] ${context}: ${kind} cannot be used as authoritative ground truth`,
    );
  }
}
