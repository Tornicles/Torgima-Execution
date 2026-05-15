/** Deterministic operational mathematics for signal / condition / adaptation (no ML). */

import type { feedback as feedbackTable, orders as ordersTable, targets as targetsTable } from "@workspace/db";
import type { signalSnapshots } from "@workspace/db";

export const OPERATIONAL_MATH_SCHEMA_VERSION = 1 as const;

export type OperationalScoreDef = {
  value: number;
  /** 0–1 unless noted */
  normalized: number;
  formula: string;
  degradation_rule: string;
  recovery_rule: string;
  weighting_notes: string;
};

export type OperationalMathematicsDocument = {
  schemaVersion: typeof OPERATIONAL_MATH_SCHEMA_VERSION;
  computedAtIso: string;
  window: { startIso: string; endIso: string };
  blueprintId: string;
  userId: string;
  scores: {
    completion_rate: OperationalScoreDef;
    execution_consistency: OperationalScoreDef;
    momentum_score: OperationalScoreDef;
    stability_score: OperationalScoreDef;
    dependency_pressure: OperationalScoreDef;
    recovery_score: OperationalScoreDef;
    signal_volatility: OperationalScoreDef;
    progression_health: OperationalScoreDef;
    proof_reliability: OperationalScoreDef;
    strategic_alignment: OperationalScoreDef;
  };
  consequenceDeltas: Record<string, number>;
  adaptationExplanation: string;
  domainCouplingNote: string;
  strategicMemoryHints: string[];
  inputs: Record<string, unknown>;
};

type FeedbackRow = typeof feedbackTable.$inferSelect;
type OrderRow = typeof ordersTable.$inferSelect;
type TargetRow = typeof targetsTable.$inferSelect;
type SnapRow = typeof signalSnapshots.$inferSelect;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function stdDev(nums: number[]): number {
  if (nums.length === 0) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

function dayBucketScoreSeries(rows: FeedbackRow[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const f of rows) {
    const d = new Date(f.created_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const arr = m.get(key) ?? [];
    arr.push(f.score ?? 0);
    m.set(key, arr);
  }
  return m;
}

export function computeProofReliability(rows: FeedbackRow[], orderProofRequired: Map<string, boolean>): number {
  let denom = 0;
  let numer = 0;
  for (const f of rows) {
    const need = orderProofRequired.get(f.order_id);
    if (!need) continue;
    denom++;
    const p = f.proof_json as Record<string, unknown> | null;
    const valid = p != null && typeof p === "object" && Object.keys(p).length > 0 && f.validity !== "invalid";
    if (valid) numer++;
  }
  if (denom === 0) return 1;
  return clamp01(numer / denom);
}

export function computeOperationalMathematics(params: {
  blueprintId: string;
  userId: string;
  windowStart: Date;
  windowEnd: Date;
  feedbackRows: FeedbackRow[];
  orders: OrderRow[];
  targets: TargetRow[];
  previousSnapshot: SnapRow | null;
  signalMetrics: {
    completion_rate: number;
    weighted_score: number;
    momentum: number;
    trend: string;
    confidence: string;
    blocker_ratio: number;
    skip_ratio: number;
  };
  blueprintDomain: string | null;
}): OperationalMathematicsDocument {
  const { feedbackRows, orders, targets, previousSnapshot, signalMetrics, blueprintDomain } = params;

  const denomFb = Math.max(1, feedbackRows.length);
  const completedFb = feedbackRows.filter(
    (f) => f.completion_status === "completed" || f.completion_status === "partial",
  ).length;
  const completion_rate = clamp01(completedFb / denomFb);

  const scoresList = feedbackRows.map((f) => f.score ?? 0);
  const stdev = stdDev(scoresList);
  const mean = scoresList.length ? scoresList.reduce((a, b) => a + b, 0) / scoresList.length : 0;
  const execution_consistency =
    scoresList.length < 2 ? 0.5 : clamp01(1 - Math.min(1, stdev / Math.max(mean, 0.75)));

  const momentum_normalized = clamp01(signalMetrics.momentum / 14);

  const bucketMap = dayBucketScoreSeries(feedbackRows);
  const dailyMeans = [...bucketMap.values()].map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
  const dayVolatility = dailyMeans.length < 2 ? 0 : stdDev(dailyMeans) / 10;
  const signal_volatility = clamp01(
    Math.max(
      dayVolatility,
      previousSnapshot
        ? Math.abs(signalMetrics.weighted_score - Number(previousSnapshot.weighted_score)) / 10
        : 0,
    ),
  );

  const stability_score = clamp01(
    execution_consistency * 0.4 + momentum_normalized * 0.4 + (1 - signal_volatility) * 0.2,
  );

  const incompleteOrders = orders.filter(
    (o) => !["completed", "skipped", "cancelled", "failed"].includes(o.status),
  ).length;
  const blockedOrders = orders.filter((o) => o.status === "blocked").length;
  const dependency_pressure = clamp01(
    orders.length === 0 ? 0 : (blockedOrders + signalMetrics.blocker_ratio * incompleteOrders) / Math.max(1, orders.length),
  );

  const failed = feedbackRows.filter((f) => f.completion_status === "failed").length;
  const recovery_score = clamp01(1 - failed / denomFb);

  const progression_health =
    targets.length === 0
      ? 0.5
      : clamp01(
          targets.reduce((acc, t) => acc + clamp01(t.progress > 1 ? t.progress / 100 : t.progress), 0) /
            targets.length,
        );

  const proofMap = new Map<string, boolean>();
  for (const o of orders) proofMap.set(o.id, o.proof_required);

  const proof_reliability = computeProofReliability(feedbackRows, proofMap);

  const domainFactor = domainCouplingFactor(blueprintDomain, signalMetrics);
  const strategic_alignment = clamp01(
    completion_rate * 0.35 +
      progression_health * 0.25 +
      (1 - dependency_pressure) * 0.2 +
      proof_reliability * 0.1 +
      execution_consistency * 0.1,
  ) * domainFactor;

  const baseDoc: OperationalMathematicsDocument = {
    schemaVersion: OPERATIONAL_MATH_SCHEMA_VERSION,
    computedAtIso: params.windowEnd.toISOString(),
    window: { startIso: params.windowStart.toISOString(), endIso: params.windowEnd.toISOString() },
    blueprintId: params.blueprintId,
    userId: params.userId,
    scores: {
      completion_rate: {
        value: completion_rate,
        normalized: completion_rate,
        formula: "completed_or_partial_feedback / max(1, feedback_events_in_window)",
        degradation_rule: "Drops when skipped or failed share increases",
        recovery_rule: "Rises when completed/partial share increases next window",
        weighting_notes: "Primary execution throughput read",
      },
      execution_consistency: {
        value: execution_consistency,
        normalized: execution_consistency,
        formula: "1 - min(1, stdev(scores)/max(mean_score,0.75)); neutral 0.5 if <2 samples",
        degradation_rule: "Volatile scores drive consistency down",
        recovery_rule: "Tight score band around mean restores consistency",
        weighting_notes: "Feeds stability_score",
      },
      momentum_score: {
        value: momentum_normalized,
        normalized: momentum_normalized,
        formula: "clamp01(momentum_integer / 14) where momentum_integer = consecutive active days with completion",
        degradation_rule: "Broken streak decays momentum",
        recovery_rule: "Daily completion restores streak",
        weighting_notes: "Same integer as legacy signal engine",
      },
      stability_score: {
        value: stability_score,
        normalized: stability_score,
        formula: "0.4*execution_consistency + 0.4*momentum_score + 0.2*(1 - signal_volatility)",
        degradation_rule: "Low consistency or high volatility drags stability",
        recovery_rule: "Rising consistency + falling volatility recover stability",
        weighting_notes: "Feeds condition heuristics downstream",
      },
      dependency_pressure: {
        value: dependency_pressure,
        normalized: dependency_pressure,
        formula: "(blocked_orders + blocker_ratio*incomplete_orders)/max(1,total_orders)",
        degradation_rule: "More blocked / incomplete inflates pressure",
        recovery_rule: "Clearing blockers and completing prerequisites reduces pressure",
        weighting_notes: "Drives consequence emphasis",
      },
      recovery_score: {
        value: recovery_score,
        normalized: recovery_score,
        formula: "1 - failed_feedback / max(1,feedback_count)",
        degradation_rule: "Failed completions erode recovery score",
        recovery_rule: "Failure-free windows rebuild recovery score",
        weighting_notes: "Paired with recovery condition explanations",
      },
      signal_volatility: {
        value: signal_volatility,
        normalized: signal_volatility,
        formula: "max(daily_mean_volatility, |weighted_score_t - weighted_score_t-1|/10)",
        degradation_rule: "Increases on erratic day-to-day performance or score jumps",
        recovery_rule: "Steady daily means and small score deltas reduce volatility",
        weighting_notes: "Penalty inside stability_score",
      },
      progression_health: {
        value: progression_health,
        normalized: progression_health,
        formula: "mean(clamp01(target.progress)) with progress>1 treated as percentage /100",
        degradation_rule: "Stalled targets drag health",
        recovery_rule: "Target progress field updates raise health",
        weighting_notes: "Uses persisted target.progress only",
      },
      proof_reliability: {
        value: proof_reliability,
        normalized: proof_reliability,
        formula: "valid_non_empty_proof_submissions / max(1,proof_required_feedback_events)",
        degradation_rule: "Missing proof on required orders reduces reliability",
        recovery_rule: "Valid proof payloads restore reliability",
        weighting_notes: "Never fabricates proof — uses rows only",
      },
      strategic_alignment: {
        value: strategic_alignment,
        normalized: clamp01(strategic_alignment),
        formula:
          "clamp01(0.35*completion + 0.25*progression + 0.2*(1-dep_pressure) + 0.1*proof_rel + 0.1*consistency) * domain_coupling_factor",
        degradation_rule: "Any pillar weakens composite alignment",
        recovery_rule: "Uniform improvement across pillars restores alignment",
        weighting_notes: "Domain coupling is deterministic matrix factor",
      },
    },
    consequenceDeltas: {},
    adaptationExplanation: "",
    domainCouplingNote: "",
    strategicMemoryHints: [],
    inputs: {
      feedback_count: feedbackRows.length,
      orders_count: orders.length,
      targets_count: targets.length,
      trend: signalMetrics.trend,
      confidence: signalMetrics.confidence,
      domain: blueprintDomain,
    },
  };

  return applyConsequencesAndAdaptation(baseDoc);
}

function domainCouplingFactor(domain: string | null, m: { completion_rate: number; skip_ratio: number }): number {
  const stress = m.skip_ratio + (1 - m.completion_rate) * 0.5;
  const d = (domain ?? "genesis").toLowerCase();
  const table: Record<string, number> = {
    business: 1 - Math.min(0.15, stress * 0.1),
    delivery: 1 - Math.min(0.12, stress * 0.08),
    continuity: 1 - Math.min(0.2, stress * 0.12),
    genesis: 1,
  };
  return clamp01(table[d] ?? 1 - Math.min(0.1, stress * 0.05));
}

function applyConsequencesAndAdaptation(doc: OperationalMathematicsDocument): OperationalMathematicsDocument {
  const dep = doc.scores.dependency_pressure.normalized;
  const vol = doc.scores.signal_volatility.normalized;
  const proof = doc.scores.proof_reliability.normalized;

  const deltas: Record<string, number> = {};
  if (dep > 0.45) {
    deltas.stability_score = -0.05;
    deltas.strategic_alignment = -0.04;
  }
  if (vol > 0.55) {
    deltas.stability_score = (deltas.stability_score ?? 0) - 0.04;
  }
  if (proof < 0.5) {
    deltas.strategic_alignment = (deltas.strategic_alignment ?? 0) - 0.06;
    deltas.recovery_score = -0.03;
  }

  const next: OperationalMathematicsDocument = { ...doc, scores: { ...doc.scores }, consequenceDeltas: deltas };

  for (const [k, delta] of Object.entries(deltas)) {
    const key = k as keyof typeof next.scores;
    const s = next.scores[key];
    if (!s) continue;
    const nv = clamp01(s.normalized + delta);
    next.scores[key] = { ...s, normalized: nv, value: nv };
  }

  const lines: string[] = [];
  if (dep > 0.45) lines.push("Dependency pressure crossed midline — execution graph is constraint-bound.");
  if (vol > 0.55) lines.push("Signal volatility elevated — window-to-window execution variance is high.");
  if (proof < 0.55) lines.push("Proof reliability soft — required proof payloads are missing or sparse.");
  if (next.scores.recovery_score.normalized < 0.55) lines.push("Recovery score indicates recent failed execution cycles in-window.");
  if (lines.length === 0) lines.push("No automatic adaptation triggers fired — enforcement package inherits prior posture.");

  next.adaptationExplanation = lines.join(" ");
  next.domainCouplingNote = `Domain coupling factor applied using static coupling table for domain "${String(doc.inputs.domain ?? "default")}".`;

  next.strategicMemoryHints = buildStrategicMemoryHints(next);
  return next;
}

function buildStrategicMemoryHints(doc: OperationalMathematicsDocument): string[] {
  const hints: string[] = [];
  if (doc.scores.dependency_pressure.normalized > 0.4)
    hints.push("Pattern: dependency pressure recurrent — prioritize prerequisite clearing.");
  if (doc.scores.proof_reliability.normalized < 0.6)
    hints.push("Pattern: proof discipline intermittent — tighten proof validation on emitted orders.");
  if (doc.scores.momentum_score.normalized > 0.65 && doc.scores.completion_rate.normalized > 0.65) {
    hints.push("Pattern: strong cadence window — scaling permissible only inside enforcement allowances.");
  }
  return hints.slice(0, 5);
}
