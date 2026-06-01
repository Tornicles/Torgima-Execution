import type { signalSnapshots } from "@workspace/db";
import type { SignalMetrics } from "./SignalCalculationEngine.types.js";
import { CONDITIONS, type Condition } from "../../constants/conditions.js";
import { assignConditionFromMetricMatrix } from "./ConditionMetricMatrix.js";

export type FormulaStep = {
  step: number;
  label: string;
  value: string;
  passed: boolean;
  explanation: string;
};

export type MatchedRule = {
  condition: string;
  rule_description: string;
  your_value: string;
  threshold: string;
};

export type SignalBreakdown = {
  completion_rate: number;
  weighted_score: number;
  momentum: number;
  trend: string;
  confidence: string;
  tasks_in_window: number;
  condition: string;
  formula_steps: FormulaStep[];
  matched_rule: MatchedRule;
  window_start: string;
  window_end: string;
  snapshot_id: string;
  generated_at: string;
};

type SnapshotRow = typeof signalSnapshots.$inferSelect;

export function buildConditionExplanation(snapshot: {
  condition: string;
  completion_rate: number;
  weighted_score: number;
  momentum: number;
  trend: string;
}): string {
  const rate = Math.round(snapshot.completion_rate * 100);
  const score = Number(snapshot.weighted_score).toFixed(1);

  const explanations: Record<string, string> = {
    nothingness: "Insufficient data or very low execution. System is waiting for real activity.",
    danger: `${rate}% completion and ${score}/10 score with a ${snapshot.trend} trend. System is in correction mode — tasks are restricted to recovery only.`,
    urgency: `${rate}% completion and ${score}/10 score. Execution is inconsistent. System is simplifying your workload to rebuild consistency.`,
    stability: `${rate}% completion and ${score}/10 score with a ${snapshot.trend} trend. System recognizes consistent execution. Full task load unlocked.`,
    power: `${rate}% completion, ${score}/10 score, ${snapshot.momentum}-day streak, ${snapshot.trend} trend. Strong performance. System is scaling your workload.`,
    affluence: `${rate}% completion, ${score}/10 score, ${snapshot.momentum}-day streak. Peak execution. System is maximizing your output.`,
    power_change:
      "Rapid condition change detected (2+ levels in 24 hours). System is in controlled transition — monitoring before confirming new state.",
  };

  return explanations[snapshot.condition] ?? `Condition: ${snapshot.condition}`;
}

export function buildFormulaSteps(snapshot: {
  completion_rate: number;
  weighted_score: number;
  momentum: number;
  trend: string;
  confidence: string;
  condition: string;
}): FormulaStep[] {
  const cr = Number(snapshot.completion_rate);
  const ws = Number(snapshot.weighted_score);
  const momentum = Number(snapshot.momentum);
  const trend = snapshot.trend ?? "stable";
  const confidence = snapshot.confidence ?? "insufficient_data";
  const condition = snapshot.condition ?? "nothingness";

  return [
    {
      step: 1,
      label: "Tasks Completed (7 days)",
      value: `${Math.round(cr * 100)}%`,
      passed: cr >= 0.5,
      explanation:
        `You completed ${Math.round(cr * 100)}% of tasks in the last 7 days. ` +
        `${cr >= 0.5 ? "This meets the stability threshold (50%+)." : "Below 50% — system is in a corrective state."}`,
    },
    {
      step: 2,
      label: "Quality Score (weighted)",
      value: `${ws.toFixed(1)} / 10`,
      passed: ws >= 5.5,
      explanation:
        `Your average quality score is ${ws.toFixed(1)}/10, weighted by feedback confidence. ` +
        `${ws >= 5.5 ? "Meets quality threshold." : "Below threshold — reflects weak or low-confidence feedback."}`,
    },
    {
      step: 3,
      label: "Momentum (consecutive days)",
      value: `${momentum} day${momentum !== 1 ? "s" : ""}`,
      passed: momentum >= 1,
      explanation:
        `You have completed tasks on ${momentum} consecutive day(s). ` +
        (momentum >= 7
          ? "Affluence-level momentum."
          : momentum >= 3
            ? "Power-level momentum — system recognizes sustained execution."
            : momentum >= 1
              ? "Building streak — keep completing daily."
              : "No active streak — consistency is breaking the signal."),
    },
    {
      step: 4,
      label: "Trend (7-day vs prior 7-day)",
      value: trend,
      passed: !["declining"].includes(trend),
      explanation:
        `Your performance trend is ${trend}. ` +
        (trend === "rising"
          ? "Score and completion rate both improving."
          : trend === "declining"
            ? "Score or completion rate is falling — system may escalate restriction."
            : trend === "recovering"
              ? "Recovering from a low period — system is loosening restrictions."
              : "Holding steady — no significant change from last week."),
    },
    {
      step: 5,
      label: "Signal Confidence",
      value: confidence,
      passed: confidence !== "insufficient_data",
      explanation:
        `Signal confidence is ${confidence}. ` +
        (confidence === "high"
          ? "6+ quality feedback records — strong signal."
          : confidence === "medium"
            ? "3-5 feedback records — signal reliable but not confirmed."
            : confidence === "low"
              ? "Few feedback records or gaming detected — signal is weak."
              : "Not enough data yet — submit more feedback to establish a signal."),
    },
    {
      step: 6,
      label: "Condition Assigned",
      value: condition.toUpperCase(),
      passed: true,
      explanation: buildConditionExplanation({ condition, completion_rate: cr, weighted_score: ws, momentum, trend }),
    },
  ];
}

export function buildMatchedRule(metrics: SignalMetrics, condition: string): MatchedRule {
  const crPct = `${Math.round(metrics.completion_rate * 100)}%`;
  const score = metrics.weighted_score.toFixed(1);

  const rules: Array<{ match: (m: SignalMetrics) => boolean; rule: MatchedRule }> = [
    {
      match: (m) =>
        m.confidence === "insufficient_data" ||
        m.tasks_in_window < 3 ||
        (m.completion_rate < 0.1 && m.weighted_score < 2),
      rule: {
        condition: CONDITIONS.NOTHINGNESS,
        rule_description: "Insufficient data or execution below bootstrap threshold",
        your_value: `${crPct} completion, ${score}/10 score, ${metrics.tasks_in_window} tasks`,
        threshold: "<3 tasks or (<10% completion and <2.0 score)",
      },
    },
    {
      match: (m) =>
        m.completion_rate < 0.3 &&
        m.weighted_score < 4 &&
        (m.trend === "declining" || m.momentum === 0),
      rule: {
        condition: CONDITIONS.DANGER,
        rule_description: "Low completion and score with declining trend or no momentum",
        your_value: `${crPct} completion, ${score}/10 score, trend ${metrics.trend}`,
        threshold: "<30% completion, <4.0 score, declining or 0-day streak",
      },
    },
    {
      match: (m) =>
        m.completion_rate >= 0.3 && m.completion_rate < 0.5 && m.weighted_score >= 4 && m.weighted_score < 5.5,
      rule: {
        condition: CONDITIONS.URGENCY,
        rule_description: "Moderate completion with mid-range quality score",
        your_value: `${crPct} completion, ${score}/10 score`,
        threshold: "30-50% completion, 4.0-5.5 weighted score",
      },
    },
    {
      match: (m) =>
        m.completion_rate >= 0.5 &&
        m.completion_rate < 0.7 &&
        m.weighted_score >= 5.5 &&
        m.weighted_score < 7 &&
        (m.trend === "stable" || m.trend === "recovering"),
      rule: {
        condition: CONDITIONS.STABILITY,
        rule_description: "Consistent execution with stable or recovering trend",
        your_value: `${crPct} completion, ${score}/10 score, trend ${metrics.trend}`,
        threshold: "50-70% completion, 5.5-7.0 score, stable/recovering",
      },
    },
    {
      match: (m) =>
        m.completion_rate >= 0.7 &&
        m.completion_rate < 0.85 &&
        m.weighted_score >= 7 &&
        m.weighted_score < 8.5 &&
        (m.trend === "stable" || m.trend === "rising") &&
        m.momentum >= 3,
      rule: {
        condition: CONDITIONS.POWER,
        rule_description: "Strong completion and quality with sustained momentum",
        your_value: `${crPct} completion, ${score}/10 score, ${metrics.momentum}-day streak`,
        threshold: "70-85% completion, 7.0-8.5 score, 3+ day streak",
      },
    },
    {
      match: (m) =>
        m.completion_rate > 0.85 && m.weighted_score > 8.5 && m.trend === "rising" && m.momentum >= 7,
      rule: {
        condition: CONDITIONS.AFFLUENCE,
        rule_description: "Peak execution with rising trend and long streak",
        your_value: `${crPct} completion, ${score}/10 score, ${metrics.momentum}-day streak`,
        threshold: ">85% completion, >8.5 score, rising, 7+ day streak",
      },
    },
  ];

  for (const { match, rule } of rules) {
    if (match(metrics) && rule.condition === condition) {
      return rule;
    }
  }

  return {
    condition,
    rule_description: "Fallback tier from completion rate (risk overrides growth)",
    your_value: `${crPct} completion, ${score}/10 score`,
    threshold: assignConditionFromMetricMatrix(metrics, "nothingness") === condition ? "matrix match" : "rate-based fallback",
  };
}

export function buildSignalBreakdownFromSnapshot(
  row: SnapshotRow,
  tasksInWindow?: number,
): SignalBreakdown {
  const metrics: SignalMetrics = {
    completion_rate: Number(row.completion_rate),
    weighted_score: Number(row.weighted_score),
    momentum: Number(row.momentum),
    trend: row.trend ?? "stable",
    confidence: row.confidence ?? "insufficient_data",
    tasks_in_window: tasksInWindow ?? 0,
    blocker_ratio: Number(row.blocker_ratio ?? 0),
    skip_ratio: Number(row.skip_ratio ?? 0),
    raw_score: Number(row.weighted_score),
    avg_difficulty_felt: null,
  };

  const condition = row.assigned_condition ?? "nothingness";

  return {
    completion_rate: metrics.completion_rate,
    weighted_score: metrics.weighted_score,
    momentum: metrics.momentum,
    trend: metrics.trend,
    confidence: metrics.confidence,
    tasks_in_window: metrics.tasks_in_window,
    condition,
    formula_steps: buildFormulaSteps({
      ...metrics,
      condition,
    }),
    matched_rule: buildMatchedRule(metrics, condition),
    window_start: row.window_start.toISOString(),
    window_end: (row.window_end ?? row.created_at).toISOString(),
    snapshot_id: row.id,
    generated_at: new Date().toISOString(),
  };
}
