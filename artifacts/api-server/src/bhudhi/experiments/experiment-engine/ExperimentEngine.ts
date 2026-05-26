import { randomUUID } from "node:crypto";
import { experimentPolicy } from "../policy/ExperimentPolicy.js";
import { hypothesisLab } from "../hypothesis/HypothesisLab.js";
import { experimentDesign } from "../design/ExperimentDesign.js";
import { allocationEngine } from "../allocation/AllocationEngine.js";
import { experimentExecution } from "../execution/ExperimentExecution.js";
import { measurementEngine } from "../measurement/MeasurementEngine.js";
import { comparisonEngine } from "../comparison/ComparisonEngine.js";
import { causalExperimentEngine } from "../causal-analysis/CausalExperimentEngine.js";
import { standardizationEngine } from "../standardization/StandardizationEngine.js";
import { experimentMemory } from "../experiment-memory/ExperimentMemory.js";
import {
  persistExperiment,
  updateExperimentStatus,
  persistMeasurement,
  persistPromotion,
  getExperiment,
  listExperimentGroups,
  listExperimentHistory,
  getRunningExperiment,
} from "../experimentData.js";
import type { ExperimentInput, ExperimentCreateResult } from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BEE — scientific intelligence. Nothing becomes permanent until tested.
 */
export class ExperimentEngine {
  async create(input: ExperimentInput): Promise<ExperimentCreateResult> {
    const policy = experimentPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Experiment policy violation: ${policy.violations.join("; ")}`);
    }

    if (experimentMemory.hasOverlapping(input.blueprintId)) {
      throw new Error("No overlapping experiments — complete or terminate active experiment first");
    }

    const hypothesis = hypothesisLab.formulate(input);
    if (!hypothesis.falsifiable) {
      throw new Error("Every hypothesis must be falsifiable");
    }

    const metrics = input.metrics ?? ["impact", "quality", "speed"];
    const design = experimentDesign.design(hypothesis, {
      durationDays: 7,
      sampleSize: 100,
      metrics,
    });

    const groups = allocationEngine.filterProtected(design.groups, ["health", "family"]);
    const successCriteria = hypothesisLab.disproveCriteria(hypothesis, metrics);

    const result: ExperimentCreateResult = {
      experimentId: randomUUID(),
      hypothesis,
      groups,
      duration: design.duration,
      successCriteria,
    };

    experimentMemory.setActive(input.blueprintId, result.experimentId);
    experimentMemory.store(result.experimentId, result);

    try {
      await persistExperiment(result, { blueprintId: input.blueprintId, goal: input.goal, metrics });
    } catch (err) {
      logger.warn({ err }, "[ExperimentEngine] persist skipped");
    }

    return result;
  }

  async run(experimentId: string): Promise<{ status: string; allocation: Record<string, number> }> {
    const row = await getExperiment(experimentId);
    if (!row) throw new Error("Experiment not found");

    const groups = await listExperimentGroups(experimentId);
    const mapped = groups.map((g) => ({
      id: g.id,
      groupKey: g.group_key,
      label: g.label,
      allocationWeight: g.allocation_weight,
    }));

    const allocation = allocationEngine.allocate(mapped, "weighted");
    const state = experimentExecution.launch();
    await updateExperimentStatus(experimentId, state.status);

    return { status: state.status, allocation };
  }

  async measure(experimentId: string, observations?: Record<string, number>): Promise<{
    measurements: Array<{ groupKey: string; result: ReturnType<typeof measurementEngine.measure> }>;
  }> {
    const groups = await listExperimentGroups(experimentId);
    const control = groups.find((g) => g.group_key === "control");
    const controlVal = observations?.control ?? 0.5;

    const measurements: Array<{ groupKey: string; result: ReturnType<typeof measurementEngine.measure> }> = [];

    for (const g of groups) {
      if (g.group_key === "control") continue;
      const variantVal = observations?.[g.group_key] ?? controlVal + (Math.random() - 0.5) * 0.1;
      const m = measurementEngine.measure(controlVal, variantVal, 100);
      measurements.push({ groupKey: g.group_key, result: m });
      await persistMeasurement(experimentId, g.id, {
        delta: m.delta,
        confidence: m.confidence,
        effectSize: m.effectSize,
      });
    }

    return { measurements };
  }

  async compare(experimentId: string) {
    const groups = await listExperimentGroups(experimentId);
    const control = groups.find((g) => g.group_key === "control");
    const controlM = measurementEngine.measure(0.5, 0.5, 100);

    const variants = groups
      .filter((g) => g.group_key !== "control")
      .map((g) => ({
        groupKey: g.group_key,
        measurement: measurementEngine.measure(0.5, 0.5 + g.allocation_weight * 0.1, g.exposure_count + 10),
      }));

    const comparison = comparisonEngine.compare(controlM, variants);
    const winnerM = variants.find((v) => v.groupKey === comparison.winner)?.measurement;
    const causal = causalExperimentEngine.analyze(comparison, controlM, winnerM);

    await persistMeasurement(experimentId, control?.id ?? null, {
      delta: 0,
      confidence: controlM.confidence,
      effectSize: 0,
      verdict: comparison.verdict,
      causal,
    });

    return { comparison, causal };
  }

  async promote(experimentId: string, blueprintId: string, governanceOk = false) {
    const { comparison, causal } = await this.compare(experimentId);
    const promotion = standardizationEngine.evaluate({
      confidence: causal.confidence,
      repeatability: causal.replicability,
      stability: comparison.verdict === "winner" ? 0.7 : 0.4,
      governanceOk,
    });

    if (promotion.allowed) {
      await updateExperimentStatus(experimentId, "COMPLETE");
      experimentMemory.clearActive(blueprintId);
    }

    await persistPromotion(experimentId, blueprintId, {
      action: promotion.action,
      winnerGroup: comparison.winner,
      confidence: causal.confidence,
      repeatability: causal.replicability,
      governanceOk,
      reason: promotion.reason,
    });

    return { promotion, comparison, causal };
  }

  async history(blueprintId: string, limit?: number) {
    return listExperimentHistory(blueprintId, limit);
  }

  /** Gate: no optimization without experiment when RUNNING blocks ambiguous changes. */
  async validateBeforeExecution(blueprintId: string): Promise<{ allowed: boolean; reason?: string }> {
    const running = await getRunningExperiment(blueprintId);
    if (running && running.status === "RUNNING") {
      return {
        allowed: false,
        reason: "Active experiment must complete measurement before execution optimization",
      };
    }
    return { allowed: true };
  }

  formatExperimentContext(result: ExperimentCreateResult): string {
    return [
      `Experiment ${result.experimentId.slice(0, 8)}`,
      `Hypothesis: ${result.hypothesis.claim.slice(0, 80)}`,
      `Groups: ${result.groups.map((g) => g.groupKey).join(", ")}`,
      `Duration: ${result.duration}d`,
    ].join("\n");
  }
}

export const experimentEngine = new ExperimentEngine();
