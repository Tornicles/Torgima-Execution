import { randomUUID } from "node:crypto";
import { optionGenerator } from "../option-generator/OptionGenerator.js";
import { tradeoffEngine } from "../tradeoff-engine/TradeoffEngine.js";
import { decisionForecastEngine } from "../forecasting/DecisionForecast.js";
import { expectedValueEngine } from "../evaluator/ExpectedValueEngine.js";
import { decisionConfidence } from "../confidence-engine/DecisionConfidence.js";
import { decisionPolicy } from "../policy/DecisionPolicy.js";
import { metaDecision } from "../optimization/MetaDecision.js";
import { decisionMemory } from "../decision-memory/DecisionMemory.js";
import { decisionReplay } from "../replay/DecisionReplay.js";
import {
  persistDecision,
  approveDecision,
  getDecision,
  listDecisionHistory,
  saveReplay,
  rowToDecisionResult,
} from "../decisionData.js";
import type { DecisionInput, DecisionResult } from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BDIE — formal decision layer. Execution may never occur without decision formation.
 */
export class DecisionEngine {
  async create(input: DecisionInput): Promise<DecisionResult> {
    const started = Date.now();
    const decisionId = randomUUID();

    const policy = decisionPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Decision policy violation: ${policy.violations.join("; ")}`);
    }

    const options = optionGenerator.generate(input);
    const scored = expectedValueEngine.scoreOptions(options);

    for (const o of scored) {
      o.tradeoffs = tradeoffEngine.evaluate(o) as unknown as Record<string, number>;
    }

    const selected = scored[0]!;
    const ev = expectedValueEngine.evaluate(selected, scored);
    const conf = decisionConfidence.assess(input, selected.confidence, scored.length);
    const forecasts = decisionForecastEngine.forecast(selected, scored.length);
    const tradeoffMatrix = tradeoffEngine.evaluate(selected);

    const meta = metaDecision.evaluate(scored, selected, Date.now() - started);

    const explanation = [
      `Selected ${selected.optionType} option (${selected.id}) because it maximizes expected value (${ev.expectedValue.toFixed(1)}) with acceptable risk (${selected.risk.toFixed(2)}).`,
      `Tradeoffs: ${tradeoffMatrix.summary}.`,
      `Confidence ${conf.level} (${conf.score.toFixed(2)}) — cannot exceed evidence.`,
      ev.recommendation,
      meta.action === "escalate" ? "Meta: escalate for additional validation." : "",
    ]
      .filter(Boolean)
      .join(" ");

    const requiresGovernance =
      policy.escalateGovernance ||
      meta.action === "escalate" ||
      conf.level === "LOW" ||
      selected.risk > 0.8;

    const result: DecisionResult = {
      decisionId,
      options: scored,
      selected,
      confidence: conf.score,
      confidenceLevel: conf.level,
      explanation,
      approval: {
        ready: !requiresGovernance && conf.score >= 0.5,
        requiresGovernance,
        reason: requiresGovernance
          ? "Escalate to governance before execution"
          : "Decision formed and ready for execution",
      },
      tradeoffMatrix,
      forecasts,
      expectedValue: ev,
      meta,
    };

    try {
      await persistDecision(result, {
        blueprintId: input.blueprintId,
        recommendationId: input.recommendationId,
        trigger: input.trigger,
        goal: input.goal,
        context: {
          ...input.context,
          signals: input.signals,
          constraints: input.constraints,
        },
        governanceEscalated: requiresGovernance,
      });
    } catch (err) {
      logger.warn({ err, decisionId }, "[DecisionEngine] persist skipped");
    }

    decisionMemory.store(result, explanation);
    return result;
  }

  async evaluate(decisionId: string): Promise<DecisionResult | null> {
    const data = await getDecision(decisionId);
    if (!data) return null;
    return rowToDecisionResult(decisionId, data.options, data.record);
  }

  async forecast(decisionId: string) {
    const data = await getDecision(decisionId);
    if (!data) return [];
    return data.forecasts.map((f) => ({
      horizonDays: f.horizon_days,
      bestOutcome: f.best_outcome,
      expectedOutcome: f.expected_outcome,
      worstOutcome: f.worst_outcome,
      probabilities: f.probabilities as { best: number; expected: number; worst: number },
      scenarioTree: f.scenario_tree as Array<{ branch: string; probability: number }>,
    }));
  }

  async replay(decisionId: string, branchOptionId?: string) {
    const data = await getDecision(decisionId);
    if (!data) return null;

    const result = rowToDecisionResult(decisionId, data.options, data.record);
    const replay = branchOptionId
      ? decisionReplay.branch(result, branchOptionId)
      : decisionReplay.replay(result, data.record.actual_outcome);

    await saveReplay(decisionId, {
      replayType: branchOptionId ? "branch" : "replay",
      branchOptionId,
      whatHappened: replay.whatHappened,
      whatShouldHappen: replay.whatShouldHappen,
      whatWouldHappen: replay.whatWouldHappen,
      learnings: replay.learnings,
    });

    return replay;
  }

  async approve(decisionId: string): Promise<boolean> {
    return approveDecision(decisionId);
  }

  async history(blueprintId: string, limit = 20) {
    return listDecisionHistory(blueprintId, limit);
  }

  /** Required before operating execution */
  async requireDecisionForExecution(params: {
    blueprintId: string;
    recommendationId: string;
    trigger: string;
    goal: string;
    title: string;
    description: string;
    confidence: number;
    globalSignal?: string;
  }): Promise<{ allowed: boolean; decision: DecisionResult; reason?: string }> {
    const existing = await listDecisionHistory(params.blueprintId, 5);
    const prior = existing.find(
      (r) =>
        r.recommendation_id === params.recommendationId &&
        r.approval_status === "approved" &&
        r.status === "approved",
    );

    if (prior) {
      const data = await getDecision(prior.id);
      if (data) {
        const result = rowToDecisionResult(prior.id, data.options, data.record);
        return { allowed: true, decision: result };
      }
    }

    const decision = await this.create({
      trigger: params.trigger,
      goal: params.goal,
      blueprintId: params.blueprintId,
      recommendationId: params.recommendationId,
      context: {
        title: params.title,
        description: params.description,
        estimatedCost: 1000,
        timelineDays: 14,
      },
      signals: { global: params.globalSignal, confidence: params.confidence },
      constraints: params.confidence < 0.45 ? ["low_confidence"] : [],
    });

    if (!decision.approval.ready) {
      return {
        allowed: false,
        decision,
        reason: decision.approval.reason,
      };
    }

    await this.approve(decision.decisionId);
    decision.approval.ready = true;

    return { allowed: true, decision };
  }
}

export const decisionEngine = new DecisionEngine();
