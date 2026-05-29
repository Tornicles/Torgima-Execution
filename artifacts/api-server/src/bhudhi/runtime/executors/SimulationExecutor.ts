import { simulationExecution } from "../../erector/execution/SimulationExecution.js";
import type { Actor, ScenarioKind } from "../../erector/contracts/types.js";
import { ExecutionRuntime } from "../ExecutionRuntime.js";

export class SimulationExecutor {
  constructor(private runtime: ExecutionRuntime = new ExecutionRuntime()) {}

  async execute(blueprintId: string, simulation: Record<string, unknown>) {
    const name = String(simulation.name ?? "Simulation");
    const iterations = Math.min(Number(simulation.iterations ?? 5), 20);

    const executionId = await this.runtime.start({
      blueprintId,
      executionType: "simulation",
      action: `Simulate: ${name}`,
      payload: simulation,
      estimatedDurationMs: iterations * 100,
    });

    try {
      await this.runtime.updateStatus(executionId, "running", 0);

      const results: Array<Record<string, unknown>> = [];
      for (let i = 0; i < iterations; i++) {
        const iterationResult = this.runIteration(simulation, i, blueprintId);
        results.push(iterationResult);
        const progress = Math.min(Math.round(((i + 1) / iterations) * 99), 99);
        await this.runtime.updateStatus(executionId, "running", progress);
      }

      const analysis = this.analyzeResults(results);

      await this.runtime.complete(
        executionId,
        true,
        `Simulation completed: ${results.length} iterations`,
        { results, analysis },
      );

      return { success: true, executionId, analysis };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runtime.complete(executionId, false, `Simulation failed: ${message}`, {
        error: message,
      });
      throw err;
    }
  }

  private runIteration(
    simulation: Record<string, unknown>,
    iteration: number,
    blueprintId: string,
  ) {
    const rawActors = (simulation.actors as Array<Partial<Actor>>) ?? [{ id: "actor-1" }];
    const actors: Actor[] = rawActors.map((a, i) => ({
      id: String(a.id ?? `actor-${i + 1}`),
      kind: a.kind ?? "user",
      goals: a.goals ?? ["execute"],
      beliefs: a.beliefs ?? [],
      resources: a.resources ?? { capacity: 1 },
      behavior: a.behavior ?? "steady",
    }));
    const economyRaw = (simulation.economy as { economicHealth?: number; risk?: number; trajectory?: string }) ?? {};
    const economy = {
      economicHealth: economyRaw.economicHealth ?? 0.7,
      risk: economyRaw.risk ?? 0.3,
      trajectory: (economyRaw.trajectory as "growth" | "stable" | "decline") ?? "stable",
    };
    const scenarioKey = String(simulation.scenario ?? "growth");
    const scenarioByLabel: Record<string, ScenarioKind> = {
      growth: "optimistic",
      collapse: "collapse",
      stagnation: "realistic",
      baseline: "baseline",
      optimistic: "optimistic",
      realistic: "realistic",
      stress: "stress",
    };
    const scenario: ScenarioKind = scenarioByLabel[scenarioKey] ?? "realistic";
    const out = simulationExecution.run(
      String(simulation.goal ?? "Simulate"),
      actors,
      economy,
      scenario,
      Number(simulation.institutionPressure ?? 0.3),
      `${blueprintId}-${iteration}`,
      3,
    );

    return {
      iteration,
      success: out.survived,
      metric: 1 - out.pressure,
      survived: out.survived,
    };
  }

  private analyzeResults(results: Array<Record<string, unknown>>) {
    const successes = results.filter((r) => r.success).length;
    const metrics = results.map((r) => Number(r.metric ?? 0));
    return {
      successRate: results.length > 0 ? successes / results.length : 0,
      avgMetric: metrics.length > 0 ? metrics.reduce((a, b) => a + b, 0) / metrics.length : 0,
    };
  }
}

export const simulationExecutor = new SimulationExecutor();
