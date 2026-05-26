import { randomUUID } from "node:crypto";
import { expansionPolicy } from "../policy/ExpansionPolicy.js";
import { capabilityDiscovery } from "../capability-discovery/CapabilityDiscovery.js";
import { transferLearning } from "../transfer-learning/TransferLearning.js";
import { abstractionEngine } from "../abstraction/AbstractionEngine.js";
import { capabilityComposer } from "../composition/CapabilityComposer.js";
import { expansionEvaluation } from "../evaluation/ExpansionEvaluation.js";
import { expansionGovernance } from "../governance/ExpansionGovernance.js";
import { benchmarkEngine } from "../benchmarking/BenchmarkEngine.js";
import { expansionMemory } from "../expansion-memory/ExpansionMemory.js";
import { expansionRollback } from "../rollback/ExpansionRollback.js";
import {
  getExpansionStatus,
  listCapabilities,
  listExpansionHistory,
  persistExpansionCycle,
  updateCapabilityStatus,
} from "../expansionData.js";
import type {
  BenchmarkResult,
  DiscoveredCapability,
  ExpansionInput,
  ExpansionOutput,
  EvaluationResult,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BAEE — controlled capability expansion. Reuse what was learned; never bypass governance.
 */
export class ExpansionEngine {
  async discover(input: ExpansionInput): Promise<ExpansionOutput> {
    return this.runCycle(input, "discover");
  }

  async evaluate(input: ExpansionInput): Promise<ExpansionOutput> {
    return this.runCycle(input, "evaluate");
  }

  async benchmark(input: ExpansionInput): Promise<BenchmarkResult | null> {
    const out = await this.runCycle(input, "benchmark");
    return out.benchmark ?? null;
  }

  async promote(input: ExpansionInput): Promise<ExpansionOutput> {
    if (!input.governanceApproved) {
      throw new Error("Promotion requires governance approval — expansion cannot self-authorize");
    }
    return this.runCycle({ ...input, governanceApproved: true }, "promote");
  }

  async reject(input: ExpansionInput, capabilityId: string): Promise<{ rejected: boolean }> {
    await updateCapabilityStatus(capabilityId, "rejected", input.blueprintId, "reject");
    return { rejected: true };
  }

  async history(blueprintId: string, limit?: number) {
    const [history, capabilities] = await Promise.all([
      listExpansionHistory(blueprintId, limit),
      listCapabilities(blueprintId, limit),
    ]);
    return { history, capabilities, memory: expansionMemory.list(blueprintId) };
  }

  async getStatus(blueprintId: string) {
    return getExpansionStatus(blueprintId);
  }

  /** Full expansion cycle: discover → evaluate → governance (no auto-promote). */
  async expandCapability(input: ExpansionInput) {
    const status = await getExpansionStatus(input.blueprintId);
    const limits = expansionGovernance.checkLimits(
      status.activeCapabilities,
      status.testingInProgress,
    );
    if (!limits.canExpand) {
      return { message: "Expansion limits reached", issues: limits.issues, results: [] };
    }

    const discovered = await this.discover(input);
    const evaluated = await this.evaluate(input);
    const candidates = discovered.newCapabilities;

    const results = candidates.map((c) => ({
      proposalId: c.capabilityId,
      name: c.capability,
      evaluation: evaluated.evaluation,
      autoApproved: false,
      pendingApproval: !discovered.approval,
    }));

    return { results, discovered, evaluated };
  }

  async approveDecision(
    input: ExpansionInput,
    capabilityId: string,
    approved: boolean,
    decidedBy: string,
  ) {
    const cap = (await listCapabilities(input.blueprintId)).find((c) => c.capabilityId === capabilityId);
    const riskLevel: "low" | "medium" | "high" | "critical" =
      input.execution?.highRisk === true
        ? "critical"
        : (cap?.risk ?? 0) > 0.7
          ? "high"
          : (cap?.risk ?? 0) > 0.4
            ? "medium"
            : "low";

    const decision = expansionGovernance.makeDecision(approved, riskLevel);

    if (approved && decision.status === "approved") {
      await updateCapabilityStatus(capabilityId, "approved", input.blueprintId, "capability_decision", {
        decidedBy,
        approved: true,
      });
      if (input.governanceApproved) {
        return this.promote({ ...input, governanceApproved: true, capabilityId });
      }
      return {
        decision,
        promoted: false,
        message: "Approved — call promote with governanceApproved to activate",
      };
    }

    await updateCapabilityStatus(capabilityId, "rejected", input.blueprintId, "capability_decision", {
      decidedBy,
      approved: false,
    });
    return { decision, rejected: true };
  }

  async rollbackCapability(capabilityId: string, blueprintId: string, appliedBy?: string) {
    return expansionRollback.rollback(capabilityId, blueprintId, appliedBy);
  }

  formatExpansionContext(output: ExpansionOutput): string {
    return [
      `Expansion: ${output.newCapabilities.length} candidate capabilities`,
      `Confidence ${Math.round(output.confidence * 100)}% · risk ${Math.round(output.risk * 100)}%`,
      output.approval ? "Governance approved" : "Pending governance",
      output.recommendation.slice(0, 100),
    ].join("\n");
  }

  /** Expansion never bypasses governance. */
  async validateBeforeExecution(
    input: ExpansionInput,
  ): Promise<{ allowed: boolean; reason?: string; output?: ExpansionOutput }> {
    const promoted = expansionMemory.getPromoted(input.blueprintId);
    const highRisk = promoted.some((c) => c.score > 0.9);

    if (highRisk && !input.governanceApproved) {
      const output = await this.runCycle(input, "validate");
      return {
        allowed: false,
        reason: "Unapproved high-risk expansion capability — governance required",
        output,
      };
    }

    return { allowed: true };
  }

  private async runCycle(input: ExpansionInput, phase: string): Promise<ExpansionOutput> {
    const policy = expansionPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Expansion policy violation: ${policy.violations.join("; ")}`);
    }

    const seed = input.seed ?? input.blueprintId;
    const sessionId = randomUUID();

    const candidates = capabilityDiscovery.detect(input, seed);
    for (const c of candidates) {
      c.capabilityId = randomUUID();
    }

    const transfers = transferLearning.apply(input);
    void transfers;
    const abstraction = abstractionEngine.extract(input, seed);
    const composed = capabilityComposer.compose(candidates);
    void composed;

    const evaluation = expansionEvaluation.measure(input, candidates, seed);
    const previousGain =
      expansionMemory.getPromoted(input.blueprintId).reduce((s, c) => s + c.score, 0) /
      Math.max(1, expansionMemory.getPromoted(input.blueprintId).length);
    const benchmark = benchmarkEngine.compare(seed, candidates, evaluation, previousGain);

    const level = expansionGovernance.resolveLevel(candidates);
    const gov =
      phase === "promote"
        ? { approval: true, reason: "Explicit promotion with governance", level }
        : expansionGovernance.requireApproval(input, candidates, benchmark, level);

    const rejected = evaluation.action === "reject" ? candidates : [];
    const approved =
      (phase === "promote" && input.governanceApproved) ||
      (evaluation.action === "promote" && gov.approval && benchmark != null);

    const confidence = benchmark?.confidence ?? evaluation.reliability;
    const risk = evaluation.risk;

    const recommendation = this.buildRecommendation(
      candidates,
      evaluation,
      abstraction,
      approved,
      gov.reason,
    );

    const output: ExpansionOutput = {
      sessionId,
      newCapabilities: approved ? candidates : candidates.map((c) => ({ ...c, score: c.score * 0.5 })),
      confidence,
      risk,
      approval: approved,
      recommendation,
      evaluation,
      benchmark: benchmark ?? undefined,
      level: gov.level,
    };

    expansionMemory.store(input.blueprintId, output, rejected);

    try {
      await persistExpansionCycle(output, input.blueprintId, candidates, evaluation, benchmark);
    } catch (err) {
      logger.warn({ err, sessionId }, "[ExpansionEngine] persist skipped");
    }

    return output;
  }

  private buildRecommendation(
    candidates: DiscoveredCapability[],
    evaluation: EvaluationResult,
    abstraction: { evidenceCount: number },
    approved: boolean,
    govReason: string,
  ): string {
    if (abstraction.evidenceCount === 0) {
      return "Observe more cycles — no abstraction without evidence";
    }
    if (!approved) {
      return `Capability candidates discovered (${candidates.length}) — ${govReason}`;
    }
    return `Reusable capability approved: ${evaluation.action} — ${candidates[0]?.capability ?? "none"}`;
  }
}

export const expansionEngine = new ExpansionEngine();
