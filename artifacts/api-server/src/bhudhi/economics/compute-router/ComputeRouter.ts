import { providerForTrigger } from "../../bhudhiProviders.js";
import { DEFAULT_MODEL_CAPABILITIES } from "../contracts/modelCatalog.js";
import { intelligenceExchange } from "../model-selector/IntelligenceExchange.js";
import type {
  ComputeRoutePlan,
  EconomicsTaskInput,
  ExecutionMode,
  RouteStrategy,
} from "../contracts/types.js";

const SIMPLE_TRIGGERS = new Set([
  "FEEDBACK_CLASSIFICATION",
  "CLARIFICATION_PROMPT",
  "TASK_CLARIFICATION",
]);

const COMPLEX_TRIGGERS = new Set([
  "REALITY_INTELLIGENCE",
  "DIRECTION_ANALYSIS",
  "BEHAVIORAL_ANALYSIS",
  "ERECTOR_PATHS_GENERATE",
]);

const CRITICAL_TRIGGERS = new Set([
  "GOAL_STRUCTURING",
  "HIGH_RISK_VALIDATION",
  "ERECTOR_INDUSTRY_ANALYZE",
]);

function taskComplexity(trigger: string): "simple" | "medium" | "complex" | "critical" {
  if (SIMPLE_TRIGGERS.has(trigger)) return "simple";
  if (CRITICAL_TRIGGERS.has(trigger)) return "critical";
  if (COMPLEX_TRIGGERS.has(trigger) || trigger.startsWith("ERECTOR_")) return "complex";
  return "medium";
}

function modeForComplexity(c: ReturnType<typeof taskComplexity>): ExecutionMode {
  switch (c) {
    case "simple":
      return "MICRO";
    case "medium":
      return "STANDARD";
    case "complex":
      return "PREMIUM";
    case "critical":
      return "RESEARCH";
  }
}

function routeForComplexity(
  c: ReturnType<typeof taskComplexity>,
  unsafe?: boolean,
): RouteStrategy {
  if (unsafe) return "governance";
  switch (c) {
    case "simple":
      return "rules";
    case "medium":
      return "single_model";
    case "complex":
      return "multi_agent";
    case "critical":
      return "ensemble";
  }
}

export class ComputeRouter {
  route(input: EconomicsTaskInput): ComputeRoutePlan {
    if (input.unsafe) {
      return {
        route: "governance",
        modelId: "governance-block",
        provider: "rules",
        estimatedCostUsd: 0,
        estimatedLatencyMs: 0,
        expectedConfidence: 0,
        executionMode: "MICRO",
        maxTokens: 0,
        parallelism: 0,
        useCache: false,
        useMemory: false,
        useSimulation: false,
        valueScore: 0,
      };
    }

    const complexity = taskComplexity(input.trigger);
    const executionMode = modeForComplexity(complexity);
    const route = routeForComplexity(complexity, input.unsafe);
    const confidence = input.confidence ?? 0.75;
    const providerHint = providerForTrigger(input.trigger);

    const rulesModel = DEFAULT_MODEL_CAPABILITIES.find((m) => m.provider === "rules")!;
    const best =
      route === "rules"
        ? { ...rulesModel, valueScore: 100 }
        : intelligenceExchange.selectBest(confidence, {
            provider: providerHint === "gemini-search" ? "gemini-search" : providerHint,
            memory: input.memoryBytes ? 0.9 : 0.6,
            simulation: input.simulation ? 0.85 : 0.5,
            tool: providerHint === "gemini-search" ? 0.95 : 0.6,
          });

    const tokenEstimate =
      executionMode === "MICRO"
        ? 200
        : executionMode === "STANDARD"
          ? 500
          : executionMode === "PREMIUM"
            ? 900
            : executionMode === "RESEARCH"
              ? 1400
              : 2000;

    const estimatedCostUsd = (tokenEstimate / 1_000_000) * best.costPerMillion * 2;

    return {
      route,
      modelId: best.modelId,
      provider: best.provider,
      estimatedCostUsd,
      estimatedLatencyMs: best.latencyMs,
      expectedConfidence: Math.min(confidence + 0.05, 0.99),
      executionMode,
      maxTokens: tokenEstimate,
      parallelism: route === "multi_agent" ? 2 : route === "ensemble" ? 3 : 1,
      useCache: complexity === "simple",
      useMemory: Boolean(input.memoryBytes),
      useSimulation: Boolean(input.simulation),
      valueScore: best.valueScore,
    };
  }
}

export const computeRouter = new ComputeRouter();
