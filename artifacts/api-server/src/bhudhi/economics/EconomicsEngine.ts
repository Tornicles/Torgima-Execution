import { computeRouter } from "./compute-router/ComputeRouter.js";
import { confidenceExchange } from "./confidence-allocation/ConfidenceExchange.js";
import { executionRoi } from "./execution-cost/ExecutionROI.js";
import { tokenEconomy } from "./intelligence-budget/TokenEconomy.js";
import { memoryEconomics } from "./memory-cost/MemoryEconomics.js";
import { simulationEconomics } from "./simulation-economics/SimulationEconomics.js";
import { economicsObservatory } from "./observability/EconomicsObservatory.js";
import { economicsForecast } from "./forecasting/EconomicsForecast.js";
import { economicsOptimizer } from "./optimization/EconomicsOptimizer.js";
import {
  getOrCreateProfile,
  recordEconomicsSession,
  finalizeSession,
  logEconomicsEvent,
  saveForecasts,
  seedModelCapabilities,
} from "./economicsData.js";
import type { EconomicsTaskInput, IntelligenceEconomicsPlan } from "./contracts/types.js";
import { logger } from "../../lib/logger.js";

/**
 * BIEE — Intelligence Economics sits before expensive decisions.
 * Answers: "What is the cheapest safe intelligence path?"
 */
export class EconomicsEngine {
  async planIntelligencePath(input: EconomicsTaskInput): Promise<IntelligenceEconomicsPlan> {
    const profile = await getOrCreateProfile(input.userId, input.blueprintId);
    const targetConfidence = input.confidence ?? profile.target_confidence;
    const confidenceAlloc = confidenceExchange.resolve(targetConfidence);

    const compute = computeRouter.route({
      ...input,
      budgetUsd: input.budgetUsd ?? profile.daily_usd_budget,
    });

    const adjustedCost = compute.estimatedCostUsd * confidenceAlloc.costMultiplier;
    const maxTokens = Math.floor(
      compute.maxTokens / confidenceAlloc.computeMultiplier,
    );

    const tokenAllocation = tokenEconomy.allocate(maxTokens, {
      memory: compute.useMemory,
      simulation: compute.useSimulation,
    });
    const tokenBudget = {
      allocated: tokenAllocation.total,
      categories: tokenAllocation.categories as Record<string, number>,
    };

    const roi = executionRoi.evaluate(
      { ...input, budgetUsd: profile.daily_usd_budget },
      adjustedCost,
    );

    const simulation = simulationEconomics.plan(
      roi.score,
      profile.daily_usd_budget,
      input.priority ?? "normal",
    );

    const memory = memoryEconomics.classify(5, 3, "operational");

    const blocked =
      compute.route === "governance" ||
      roi.action === "cancel" ||
      (profile.daily_usd_budget > 0 && adjustedCost > profile.daily_usd_budget * 0.5);

    const plan: IntelligenceEconomicsPlan = {
      compute: { ...compute, maxTokens, estimatedCostUsd: adjustedCost },
      confidenceTier: confidenceAlloc.tier,
      confidenceCostMultiplier: confidenceAlloc.costMultiplier,
      roi,
      simulation,
      memory,
      tokenBudget,
      blocked,
      blockReason: blocked
        ? roi.action === "cancel"
          ? roi.reasoning
          : "Economics budget or governance gate"
        : undefined,
    };

    return plan;
  }

  async applyBeforeInvoke(
    input: EconomicsTaskInput & { triggerType: string },
  ): Promise<{
    plan: IntelligenceEconomicsPlan;
    sessionId: string;
    maxTokens: number;
    blocked: boolean;
  }> {
    const plan = await this.planIntelligencePath({
      ...input,
      task: input.triggerType,
      trigger: input.triggerType,
    });

    let sessionId = "";
    try {
      sessionId = await recordEconomicsSession(
        input.userId,
        input.blueprintId,
        input.triggerType,
        plan,
      );
      await logEconomicsEvent(
        input.userId,
        sessionId,
        "route_selected",
        "compute",
        plan.compute.estimatedCostUsd,
        plan.tokenBudget.allocated,
        { route: plan.compute.route, model: plan.compute.modelId },
      );
    } catch (err) {
      logger.warn({ err }, "[Economics] session persist skipped");
    }

    return {
      plan,
      sessionId,
      maxTokens: plan.compute.maxTokens,
      blocked: plan.blocked,
    };
  }

  async recordInvokeResult(
    sessionId: string,
    actual: { costUsd: number; latencyMs: number; tokensIn: number; tokensOut: number },
  ): Promise<void> {
    if (!sessionId) return;
    try {
      await finalizeSession(sessionId, actual);
    } catch (err) {
      logger.warn({ err, sessionId }, "[Economics] finalize session failed");
    }
  }

  async getObservatory(userId: string) {
    const metrics = await economicsObservatory.collect(userId);
    const proposals = economicsOptimizer.detectWaste(metrics);
    return { metrics, proposals };
  }

  async runForecast(userId: string, blueprintId?: string) {
    const metrics = await economicsObservatory.collect(userId, 24);
    const points = economicsForecast.predict({
      dailyCostUsd: metrics.costPerUser,
      dailyRequests: Math.max(1, Math.round(metrics.costPerUser / Math.max(metrics.costPerRequest, 0.001))),
      dailyTokens: metrics.tokensToday || 10_000,
    });
    try {
      await saveForecasts(userId, blueprintId, points);
    } catch {
      /* non-blocking */
    }
    return points;
  }

  async initialize(): Promise<void> {
    try {
      await seedModelCapabilities();
    } catch (err) {
      logger.warn({ err }, "[Economics] model capability seed skipped");
    }
  }
}

export const economicsEngine = new EconomicsEngine();
