import { randomUUID } from "node:crypto";
import { simulationPolicy } from "../policy/SimulationPolicy.js";
import { worldGenerator } from "../world-generator/WorldGenerator.js";
import { scenarioEngine } from "../scenario-engine/ScenarioEngine.js";
import { actorEngine } from "../actor-engine/ActorEngine.js";
import { simulationEconomy } from "../economy/SimulationEconomy.js";
import { institutionEngine } from "../institutions/InstitutionEngine.js";
import { environmentEngine } from "../environment/EnvironmentEngine.js";
import { simulationExecution } from "../execution/SimulationExecution.js";
import { simulationScore } from "../scoring/SimulationScore.js";
import { simulationMemory } from "../simulation-memory/SimulationMemory.js";
import { persistSimulationRun, listSimulationHistory } from "../erectorData.js";
import type {
  CompareResult,
  ErectorInput,
  ErectorOutput,
  SimulationScoreResult,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BERE — Bhudhi Erector Runtime Engine.
 * Construct worlds, run synthetic reality, return truth — simulation informs reality, never replaces it.
 */
export class ErectorRuntime {
  async create(input: ErectorInput): Promise<ErectorOutput> {
    return this.runLifecycle(input);
  }

  async run(input: ErectorInput): Promise<ErectorOutput> {
    return this.runLifecycle(input);
  }

  async score(simulationId: string): Promise<SimulationScoreResult | null> {
    const stored = simulationMemory.get(simulationId);
    return stored?.score ?? null;
  }

  async compare(blueprintId: string, simulationIds?: string[]): Promise<CompareResult> {
    const runs = simulationIds?.length
      ? simulationIds
          .map((id) => simulationMemory.get(id))
          .filter((r): r is ErectorOutput => r != null)
      : simulationMemory.list(blueprintId);

    const ranked = runs
      .map((r) => ({
        simulationId: r.simulationId,
        overall: r.score?.overall ?? 0,
        recommendation: r.recommendation,
      }))
      .sort((a, b) => b.overall - a.overall);

    return {
      runs: ranked,
      winner: ranked[0]?.simulationId ?? "",
    };
  }

  async replay(simulationId: string, input?: ErectorInput): Promise<ErectorOutput | null> {
    const prior = simulationMemory.replay(simulationId);
    if (!prior) return null;
    if (input) {
      return this.runLifecycle({ ...input, seed: prior.seed });
    }
    return prior.output;
  }

  async history(blueprintId: string, limit?: number) {
    return listSimulationHistory(blueprintId, limit);
  }

  formatErectorContext(output: ErectorOutput): string {
    const score = output.score;
    return [
      `Simulation ${output.simulationId.slice(0, 8)}: ${output.recommendation.slice(0, 120)}`,
      score ? `Score ${score.overall}/100 · survival ${score.survival} · risk ${score.risk}` : "",
      `Confidence ${Math.round(output.confidence * 100)}%`,
      output.outcomes.survived ? "Pressure survived" : "Pressure exceeded threshold",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Gate: simulation informs — only block catastrophic collapse scenarios. */
  async validateBeforeExecution(
    input: ErectorInput,
  ): Promise<{ allowed: boolean; reason?: string; output?: ErectorOutput }> {
    const output = await this.runLifecycle(input);
    const overall = output.score?.overall ?? 50;
    const scenario = input.scenario ?? "realistic";

    if (scenario === "collapse" && overall < 25) {
      return {
        allowed: false,
        reason: "Collapse scenario survival too low — stress-test before execution",
        output,
      };
    }

    if (!output.outcomes.survived && overall < 20) {
      return {
        allowed: false,
        reason: "Synthetic reality did not survive pressure — revise plan before execution",
        output,
      };
    }

    return { allowed: true, output };
  }

  private async runLifecycle(input: ErectorInput): Promise<ErectorOutput> {
    const policy = simulationPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Simulation policy violation: ${policy.violations.join("; ")}`);
    }

    const seed = input.seed ?? `${input.blueprintId}:${input.goal ?? "default"}`;
    const simulationId = randomUUID();
    const runId = randomUUID();
    const worldId = randomUUID();

    const { world, realism, difficulty, volatility, mode } = worldGenerator.generate(input, seed);
    const scenarios = scenarioEngine.generateAll(input, seed);
    const scenario = scenarioEngine.pick(input, seed);
    const actors = actorEngine.spawn(world, seed);
    const economy = simulationEconomy.simulate(actors, scenario, seed);
    const institutionPressure = institutionEngine.pressure(world, seed);

    let env = environmentEngine.initial(input, seed, volatility);
    for (let t = 0; t < 3; t++) {
      env = environmentEngine.evolve(env, seed, t);
    }

    const goal = input.goal ?? (input.blueprint?.title as string) ?? "Execute blueprint";
    const outcomes = simulationExecution.run(
      goal,
      actors,
      economy,
      scenario,
      institutionPressure,
      seed,
    );
    const scoreResult = simulationScore.measure(outcomes, economy, scenario);

    const recommendation = this.buildRecommendation(outcomes, scoreResult, scenario, economy);

    const output: ErectorOutput = {
      simulationId,
      runId,
      worldId,
      outcomes,
      confidence: scoreResult.confidence,
      recommendation,
      score: scoreResult,
      scenarios,
    };

    simulationMemory.store(input.blueprintId, output, seed);

    try {
      await persistSimulationRun({
        output,
        blueprintId: input.blueprintId,
        seed,
        goal,
        world,
        mode,
        realism,
        difficulty,
        volatility,
        actors,
        economy,
        env,
      });
    } catch (err) {
      logger.warn({ err, simulationId }, "[ErectorRuntime] persist skipped");
    }

    return output;
  }

  private buildRecommendation(
    outcomes: ErectorOutput["outcomes"],
    score: SimulationScoreResult,
    scenario: string,
    economy: { trajectory: string; economicHealth: number },
  ): string {
    if (!outcomes.survived) {
      return `Do not execute under ${scenario} pressure — reduce risk, improve economic health (${Math.round(economy.economicHealth * 100)}%)`;
    }
    if (score.overall >= 70) {
      return `Proceed with execution — synthetic reality survived (${score.overall}/100, ${economy.trajectory})`;
    }
    return `Simulate alternatives first — score ${score.overall}/100; strengthen resilience before reality`;
  }
}

export const erectorRuntime = new ErectorRuntime();
