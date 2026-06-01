import { useState } from "react";
import { ConditionBadge } from "@/components/ConditionBadge";

export type SignalBreakdown = {
  completion_rate: number;
  weighted_score: number;
  momentum: number;
  trend: string;
  confidence: string;
  tasks_in_window: number;
  condition: string;
  formula_steps: Array<{
    step: number;
    label: string;
    value: string;
    passed: boolean;
    explanation: string;
  }>;
  matched_rule: {
    condition: string;
    rule_description: string;
    your_value: string;
    threshold: string;
  };
  window_start: string;
  window_end: string;
  snapshot_id: string;
  generated_at: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function SignalPanelEmpty() {
  return (
    <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
      No signal snapshot yet. Complete tasks and submit feedback to establish your execution signal.
    </section>
  );
}

function SignalMetricsBar({
  completion,
  score,
  momentum,
  trend,
  confidence,
}: {
  completion: number;
  score: number;
  momentum: number;
  trend: string;
  confidence: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
      <div>
        <p className="text-lg font-bold text-gray-900">{Math.round(completion * 100)}%</p>
        <p className="text-gray-500 uppercase tracking-wide">Completion</p>
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900">{score.toFixed(1)}</p>
        <p className="text-gray-500 uppercase tracking-wide">Weighted score</p>
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900">{momentum}</p>
        <p className="text-gray-500 uppercase tracking-wide">Momentum (days)</p>
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900 capitalize">{trend}</p>
        <p className="text-gray-500 uppercase tracking-wide">Trend</p>
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900 capitalize">{confidence}</p>
        <p className="text-gray-500 uppercase tracking-wide">Confidence</p>
      </div>
    </div>
  );
}

function FormulaBreakdown({
  steps,
  matched_rule,
  defaultExpanded,
  label,
}: {
  steps: SignalBreakdown["formula_steps"];
  matched_rule: SignalBreakdown["matched_rule"];
  defaultExpanded: boolean;
  label: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="formula-breakdown border-t border-gray-100 pt-4 mt-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="formula-toggle text-sm font-medium text-[var(--torgima-primary)] hover:underline w-full text-left"
      >
        {label} {expanded ? "▲" : "▼"}
      </button>

      {expanded && (
        <div className="formula-steps mt-3 space-y-3">
          {steps.map((step) => (
            <div
              key={step.step}
              className={`formula-step rounded-lg border p-3 ${step.passed ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/40"}`}
            >
              <div className="flex items-start gap-2 text-sm">
                <span className="step-number font-mono text-gray-400 w-5">{step.step}</span>
                <span className="step-label font-medium text-gray-800 flex-1">{step.label}</span>
                <span className="step-value font-semibold text-gray-900">{step.value}</span>
                <span className={`step-indicator ${step.passed ? "text-green-600" : "text-red-600"}`}>
                  {step.passed ? "✓" : "✗"}
                </span>
              </div>
              <p className="step-explanation text-xs text-gray-600 mt-2 ml-7">{step.explanation}</p>
            </div>
          ))}

          <div className="matched-rule rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 space-y-1">
            <p>
              <strong>Rule that fired: </strong>
              {matched_rule.rule_description}
            </p>
            <p>
              <span className="font-medium">Your value: </span>
              {matched_rule.your_value}
            </p>
            <p>
              <span className="font-medium">Threshold: </span>
              {matched_rule.threshold}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FreshnessBadge({ generated_at }: { generated_at: string }) {
  const ageMin = Math.round((Date.now() - new Date(generated_at).getTime()) / 60000);
  const label = ageMin < 60 ? `${ageMin}m ago` : `${Math.round(ageMin / 60)}h ago`;
  return <p className="text-[10px] text-gray-400 mt-2">Updated {label}</p>;
}

export function SignalPanel({ breakdown }: { breakdown: SignalBreakdown | null | undefined }) {
  if (!breakdown) return <SignalPanelEmpty />;

  return (
    <section className="signal-panel rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution signal</p>
        <ConditionBadge condition={breakdown.condition} />
      </div>

      <SignalMetricsBar
        completion={breakdown.completion_rate}
        score={breakdown.weighted_score}
        momentum={breakdown.momentum}
        trend={breakdown.trend}
        confidence={breakdown.confidence}
      />

      <FormulaBreakdown
        steps={breakdown.formula_steps}
        matched_rule={breakdown.matched_rule}
        defaultExpanded={false}
        label="How was this condition calculated?"
      />

      <p className="signal-window-label text-xs text-gray-500">
        Based on {breakdown.tasks_in_window} feedback record
        {breakdown.tasks_in_window === 1 ? "" : "s"} between {formatDate(breakdown.window_start)} and{" "}
        {formatDate(breakdown.window_end)}
      </p>

      <FreshnessBadge generated_at={breakdown.generated_at} />
    </section>
  );
}
