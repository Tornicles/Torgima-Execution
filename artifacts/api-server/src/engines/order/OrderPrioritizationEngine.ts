import type { orders as ordersTable } from "@workspace/db";

type OrderRow = typeof ordersTable.$inferSelect;

const CONDITION_WEIGHT: Record<string, number> = {
  nothingness: 0,
  danger: 5,
  urgency: 4,
  stability: 2,
  power: 2,
  affluence: 1,
  power_change: 3,
};

function hashToUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 997) / 997;
}

/**
 * Deterministic composite score — higher executes first when choosing among pending/active orders.
 */
export function computeOrderPriorityDimensions(order: OrderRow, ctx: {
  /** Count of downstream orders referencing this row as blocker (estimated leverage). */
  downstreamBlockedCount: number;
  blueprintCondition?: string | null;
}): {
  priorityScore: number;
  urgencyScore: number;
  leverageScore: number;
  dependencyRiskScore: number;
  timingSensitivityScore: number;
  strategicWeight: number;
  formulaSummary: string;
} {
  const now = Date.now();
  let urgencyScore = Number(order.priority) * 12;
  if (order.status === "active") urgencyScore += 18;
  if (order.status === "blocked") urgencyScore *= 0.35;
  const due = order.due_at ? order.due_at.getTime() : null;
  if (due !== null && !Number.isNaN(due)) {
    const hours = (due - now) / 3600000;
    if (hours < 24) urgencyScore += 35;
    else if (hours < 72) urgencyScore += 18;
    else if (hours < 168) urgencyScore += 9;
    if (hours < 0) urgencyScore += Math.min(40, Math.abs(hours));
  }

  const value = order.value_score ?? order.priority ?? 5;
  const leverageScore = Math.min(100, Number(value) * 8 + ctx.downstreamBlockedCount * 14);

  const dependencyRiskScore = clamp(
    ctx.downstreamBlockedCount * 10 + (order.blocker_description ? 6 : 0),
    0,
    100,
  );

  const difficultyTier =
    order.difficulty === "very_hard"
      ? 14
      : order.difficulty === "hard"
        ? 10
        : order.difficulty === "moderate"
          ? 6
          : order.difficulty === "easy" || order.difficulty === "very_easy"
            ? 3
            : 5;
  let timingSensitivityScore =
    timingFromEstimate(order.time_estimate_minutes) + difficultyTier + (order.proof_required ? 4 : 0);

  const cond = ctx.blueprintCondition ?? "nothingness";
  const strategicWeight =
    clamp(CONDITION_WEIGHT[cond] ?? 2, 0, 10) *
      (clamp(Number(value), 1, 10) / 5 + (ctx.downstreamBlockedCount > 0 ? 1.2 : 1));

  timingSensitivityScore += (CONDITION_WEIGHT[cond] ?? 0) * 1.5;

  const stabilityTieBreaker = hashToUnit(order.id) * 0.01;

  const priorityScore =
    urgencyScore * 2.4 +
    leverageScore * 1.1 +
    dependencyRiskScore * 0.8 +
    timingSensitivityScore * 0.6 +
    strategicWeight * 3.2 +
    stabilityTieBreaker;

  return {
    priorityScore,
    urgencyScore,
    leverageScore,
    dependencyRiskScore,
    timingSensitivityScore,
    strategicWeight,
    formulaSummary:
      "priorityScore = urgency*2.4 + leverage*1.1 + depRisk*0.8 + timing*0.6 + strategicWeight*3.2 + tieBreaker",
  };
}

function timingFromEstimate(mins: number | null): number {
  if (mins == null) return 4;
  if (mins <= 15) return 16;
  if (mins <= 45) return 12;
  if (mins <= 120) return 8;
  return 5;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
