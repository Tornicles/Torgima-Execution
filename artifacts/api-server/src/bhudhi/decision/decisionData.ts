import {
  db,
  bhudhiDecisionRecords,
  bhudhiDecisionOptions,
  bhudhiDecisionForecasts,
  bhudhiDecisionScores,
  bhudhiDecisionReplay,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { DecisionResult, DecisionOption, ScenarioForecast } from "./contracts/types.js";

export async function persistDecision(result: DecisionResult, input: {
  blueprintId: string;
  recommendationId?: string;
  trigger: string;
  goal: string;
  context: Record<string, unknown>;
  governanceEscalated: boolean;
}): Promise<void> {
  await db.insert(bhudhiDecisionRecords).values({
    id: result.decisionId,
    blueprint_id: input.blueprintId,
    recommendation_id: input.recommendationId ?? null,
    trigger: input.trigger,
    goal: input.goal,
    context: input.context,
    selected_option_id: result.selected.id,
    confidence: result.confidence,
    confidence_level: result.confidenceLevel,
    explanation: result.explanation,
    status: "formed",
    approval_status: result.approval.ready ? "approved" : "pending",
    governance_escalated: input.governanceEscalated,
  });

  for (const opt of result.options) {
    await db.insert(bhudhiDecisionOptions).values({
      id: opt.id,
      decision_id: result.decisionId,
      label: opt.option,
      option_type: opt.optionType,
      description: opt.description,
      cost: opt.cost,
      timeline_days: opt.timeline,
      risk: opt.risk,
      confidence: opt.confidence,
      expected_value: opt.expectedValue ?? 0,
      selected: opt.id === result.selected.id,
      tradeoffs: opt.tradeoffs ?? {},
    });
  }

  for (const f of result.forecasts ?? []) {
    await db.insert(bhudhiDecisionForecasts).values({
      decision_id: result.decisionId,
      horizon_days: f.horizonDays,
      best_outcome: f.bestOutcome,
      expected_outcome: f.expectedOutcome,
      worst_outcome: f.worstOutcome,
      probabilities: f.probabilities,
      scenario_tree: f.scenarioTree,
    });
  }

  if (result.expectedValue) {
    await db.insert(bhudhiDecisionScores).values({
      decision_id: result.decisionId,
      option_id: result.selected.id,
      expected_value: result.expectedValue.expectedValue,
      regret: result.expectedValue.regret,
      upside: result.expectedValue.upside,
      downside: result.expectedValue.downside,
      recommendation: result.expectedValue.recommendation,
      tradeoff_matrix: result.tradeoffMatrix ?? {},
    });
  }
}

export async function approveDecision(decisionId: string): Promise<boolean> {
  const result = await db
    .update(bhudhiDecisionRecords)
    .set({ approval_status: "approved", status: "approved", updated_at: new Date() })
    .where(eq(bhudhiDecisionRecords.id, decisionId))
    .returning({ id: bhudhiDecisionRecords.id });
  return result.length > 0;
}

export async function getDecision(decisionId: string) {
  const [record] = await db
    .select()
    .from(bhudhiDecisionRecords)
    .where(eq(bhudhiDecisionRecords.id, decisionId))
    .limit(1);
  if (!record) return null;

  const options = await db
    .select()
    .from(bhudhiDecisionOptions)
    .where(eq(bhudhiDecisionOptions.decision_id, decisionId));

  const forecasts = await db
    .select()
    .from(bhudhiDecisionForecasts)
    .where(eq(bhudhiDecisionForecasts.decision_id, decisionId));

  return { record, options, forecasts };
}

export async function listDecisionHistory(blueprintId: string, limit = 20) {
  return db
    .select()
    .from(bhudhiDecisionRecords)
    .where(eq(bhudhiDecisionRecords.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiDecisionRecords.created_at))
    .limit(limit);
}

export async function saveReplay(
  decisionId: string,
  replay: {
    replayType: string;
    branchOptionId?: string;
    whatHappened: string;
    whatShouldHappen: string;
    whatWouldHappen: string;
    learnings: string[];
  },
): Promise<string> {
  const [row] = await db
    .insert(bhudhiDecisionReplay)
    .values({
      decision_id: decisionId,
      replay_type: replay.replayType,
      branch_option_id: replay.branchOptionId ?? null,
      what_happened: replay.whatHappened,
      what_should_happen: replay.whatShouldHappen,
      what_would_happen: replay.whatWouldHappen,
      learnings: replay.learnings,
    })
    .returning({ id: bhudhiDecisionReplay.id });
  return row!.id;
}

export function rowToDecisionResult(
  decisionId: string,
  options: Array<{
    id: string;
    label: string;
    option_type: string;
    description: string;
    cost: number;
    timeline_days: number;
    risk: number;
    confidence: number;
    expected_value: number;
    selected: boolean;
    tradeoffs: unknown;
  }>,
  record: {
    confidence: number;
    confidence_level: string;
    explanation: string;
    approval_status: string;
    governance_escalated: boolean;
  },
): DecisionResult {
  const mapped: DecisionOption[] = options.map((o) => ({
    id: o.id,
    option: o.label,
    optionType: o.option_type as DecisionOption["optionType"],
    description: o.description,
    cost: o.cost,
    timeline: o.timeline_days,
    risk: o.risk,
    confidence: o.confidence,
    expectedValue: o.expected_value,
    tradeoffs: o.tradeoffs as Record<string, number>,
  }));

  const selectedRow = options.find((r) => r.selected);
  const selected = mapped.find((o) => o.id === selectedRow?.id) ?? mapped[0]!;

  return {
    decisionId,
    options: mapped,
    selected,
    confidence: record.confidence,
    confidenceLevel: record.confidence_level as DecisionResult["confidenceLevel"],
    explanation: record.explanation,
    approval: {
      ready: record.approval_status === "approved",
      requiresGovernance: record.governance_escalated,
      reason:
        record.approval_status === "approved"
          ? "Decision approved"
          : "Awaiting governance or user approval",
    },
  };
}
