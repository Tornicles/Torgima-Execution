import { randomUUID } from "node:crypto";
import { beliefRegistry } from "../belief-registry/BeliefRegistry.js";
import { evidenceEngine } from "../evidence-engine/EvidenceEngine.js";
import { truthEngine } from "../truth-engine/TruthEngine.js";
import { hypothesisEngine } from "../hypothesis-engine/HypothesisEngine.js";
import { contradictionEngine } from "../contradiction-engine/ContradictionEngine.js";
import { uncertaintyEngine } from "../uncertainty/UncertaintyEngine.js";
import { beliefConfidence } from "../confidence/BeliefConfidence.js";
import { beliefPolicy } from "../policy/BeliefPolicy.js";
import { beliefEvolution } from "../evolution/BeliefEvolution.js";
import { beliefDrift } from "../drift/BeliefDrift.js";
import { beliefMemory } from "../belief-memory/BeliefMemory.js";
import {
  persistBeliefSession,
  persistTruth,
  persistEvolution,
  listBeliefHistory,
  getBelief,
  updateBeliefState,
  resolveConflict,
  rowToBeliefRecord,
} from "../beliefData.js";
import type { BeliefInput, BeliefOutput, BeliefRecord } from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BBAE — epistemic control layer. Beliefs are the source of reasoning; memory is storage only.
 */
export class BeliefEngine {
  async process(input: BeliefInput): Promise<BeliefOutput> {
    const sessionId = randomUUID();

    const policy = beliefPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Belief policy violation: ${policy.violations.join("; ")}`);
    }

    let records = beliefRegistry.classifyFromInput(input);
    const hypotheses = hypothesisEngine.generate(input, records);
    records = [...records, ...hypotheses];

    records = evidenceEngine.attachToBeliefs(records, input);
    records = evidenceEngine.enforceFactEvidence(records);

    const contradictions = contradictionEngine.detect(records);
    for (const c of contradictions) {
      if (c.action === "freeze" && c.beliefIdA) {
        const idx = records.findIndex((r) => r.beliefId === c.beliefIdA);
        if (idx >= 0) {
          const challenged = beliefEvolution.challenge(records[idx]!, c.description);
          records[idx] = challenged.record;
          await persistEvolution(challenged.event).catch(() => null);
        }
      }
    }

    const conflictLabels = contradictions.map((c) => c.description);
    for (const r of records) {
      const truth = truthEngine.assess(r, conflictLabels);
      r.truthScore = truth.truthScore;
      if (truthEngine.isExpired(truth.expiresAt)) {
        r.state = "DEPRECATED";
        r.memoryClass = "EXPIRED";
      }
    }

    const uncertainty = uncertaintyEngine.calculate(records);
    if (policy.escalateUncertainty) {
      uncertainty.recommendation = "Governance escalation recommended — epistemic policy triggered";
    }

    let rawConf = beliefConfidence.aggregate(records);
    rawConf = beliefConfidence.capByEvidence(rawConf, records);

    const drift = beliefDrift.detect(records, contradictions);

    const facts = records.filter((r) => r.type === "fact");
    const beliefs = records.filter((r) => r.type === "belief");
    const assumptions = records.filter((r) => r.type === "assumption");
    const hypos = records.filter((r) => r.type === "hypothesis");

    const output: BeliefOutput = {
      sessionId,
      facts,
      beliefs,
      assumptions,
      hypotheses: hypos,
      confidence: rawConf,
      uncertainty,
      contradictions,
      drift,
    };

    beliefMemory.store(input.blueprintId, records);

    try {
      await persistBeliefSession(output, {
        blueprintId: input.blueprintId,
        userId: input.userId,
        trigger: input.trigger,
      });
      for (const r of records.slice(0, 8)) {
        const truth = truthEngine.assess(r, conflictLabels);
        await persistTruth(r.beliefId, truth);
        await persistEvolution(beliefEvolution.trackCreate(r));
      }
    } catch (err) {
      logger.warn({ err, sessionId }, "[BeliefEngine] persist skipped");
    }

    return output;
  }

  /** Compact context for BhudhiCore pipeline (after memory, before agents). */
  formatBeliefContext(output: BeliefOutput): string {
    const lines = [
      `Epistemic session ${output.sessionId}`,
      `Known (${output.uncertainty.known.length}): ${output.uncertainty.known.slice(0, 3).join("; ") || "—"}`,
      `Unknown (${output.uncertainty.unknown.length}): ${output.uncertainty.unknown.slice(0, 2).join("; ") || "—"}`,
      `Confidence: ${(output.confidence * 100).toFixed(0)}% | Uncertainty: ${(output.uncertainty.uncertainty * 100).toFixed(0)}%`,
      output.contradictions.length > 0
        ? `Conflicts: ${output.contradictions.length} (${output.contradictions[0]!.action})`
        : "",
      output.drift?.detected ? `Drift: ${output.drift.signals.join(", ")} → ${output.drift.action}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }

  async validate(beliefId: string): Promise<BeliefRecord | null> {
    const row = await getBelief(beliefId);
    if (!row) return null;
    const record = rowToBeliefRecord(row);
    const { record: validated, event } = beliefEvolution.validate(record);
    await updateBeliefState(beliefId, "VALIDATED", validated.confidence);
    await persistEvolution(event);
    return validated;
  }

  async evolve(beliefId: string, reason: string): Promise<BeliefRecord | null> {
    const row = await getBelief(beliefId);
    if (!row) return null;
    const record = rowToBeliefRecord(row);
    const { record: updated, event } = beliefEvolution.challenge(record, reason);
    await updateBeliefState(beliefId, updated.state, updated.confidence);
    await persistEvolution(event);
    return updated;
  }

  async history(blueprintId: string, limit?: number) {
    return listBeliefHistory(blueprintId, limit);
  }

  async resolve(conflictId: string) {
    return resolveConflict(conflictId);
  }
}

export const beliefEngine = new BeliefEngine();
