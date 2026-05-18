/**
 * Prompt 8 §5 — authoritative source priority (highest wins).
 * SignalRecord > ConditionRecord > WorldModel > BhudhiMemory
 */

/** Prompt 8 canonical hierarchy */
export const SOURCE_PRIORITY = [
  "signal_record",
  "condition_record",
  "order_status",
  "world_model",
  "eis_intelligence",
  "bhudhi_memory",
  "cached_projection",
] as const;

/** Legacy Prompt 6 names — same relative ordering for existing tests */
export const LEGACY_SOURCE_PRIORITY = [
  "execution_signals",
  "condition_record",
  "signal_snapshot",
  "enforcement_package",
  "eis_intelligence",
  "bhudhi_interpretation",
  "cached_projection",
] as const;

export type SourceKind =
  | (typeof SOURCE_PRIORITY)[number]
  | (typeof LEGACY_SOURCE_PRIORITY)[number];

const RANK_MAP: Record<string, number> = {
  signal_record: 0,
  execution_signals: 0,
  signal_snapshot: 0,
  condition_record: 1,
  order_status: 2,
  enforcement_package: 2,
  world_model: 3,
  eis_intelligence: 4,
  bhudhi_memory: 5,
  bhudhi_interpretation: 5,
  cached_projection: 6,
};

export function sourceRank(kind: SourceKind): number {
  return RANK_MAP[kind] ?? 99;
}

export function canOverride(winner: SourceKind, challenger: SourceKind): boolean {
  return sourceRank(winner) < sourceRank(challenger);
}

export function assertAuthoritativeSource(kind: SourceKind, context: string): void {
  if (
    kind === "bhudhi_interpretation" ||
    kind === "bhudhi_memory" ||
    kind === "cached_projection"
  ) {
    throw new Error(
      `[SourceOfTruth] ${context}: ${kind} cannot be used as authoritative ground truth`,
    );
  }
}

export interface TrajectorySnapshot {
  completionRate: number;
  momentum: number;
}

export function computeTrajectoryDrift(
  world: TrajectorySnapshot,
  signal: TrajectorySnapshot,
): number {
  const completionDrift = Math.abs(world.completionRate - signal.completionRate);
  const momentumDrift = Math.abs(world.momentum - signal.momentum) / 100;
  return (completionDrift + momentumDrift) / 2;
}

export function resolveSignalDrift(
  world: TrajectorySnapshot,
  signal: TrajectorySnapshot,
  threshold = 0.2,
): { corrected: TrajectorySnapshot; drift: number; updated: boolean } {
  const drift = computeTrajectoryDrift(world, signal);
  if (drift <= threshold) {
    return { corrected: world, drift, updated: false };
  }
  return {
    corrected: {
      completionRate: signal.completionRate,
      momentum: signal.momentum,
    },
    drift,
    updated: true,
  };
}
