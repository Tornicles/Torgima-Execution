import { randomUUID } from "node:crypto";
import { civilizationPolicy } from "../policy/CivilizationPolicy.js";
import { populationEngine } from "../population/PopulationEngine.js";
import { civilInstitutionEngine } from "../institutions/CivilInstitutionEngine.js";
import { ecosystemEngine } from "../ecosystems/EcosystemEngine.js";
import { civilEconomy } from "../economy/CivilEconomy.js";
import { evolutionEngine } from "../evolution/EvolutionEngine.js";
import { civilGovernance } from "../governance/CivilGovernance.js";
import { civilResilience } from "../resilience/CivilResilience.js";
import { longHorizonEngine } from "../evolution/LongHorizonEngine.js";
import { civilizationMemory } from "../civilization-memory/CivilizationMemory.js";
import { persistCivilization, listCivilizationHistory } from "../civilizationData.js";
import type {
  CivilizationInput,
  CivilizationOutput,
  CivilizationState,
  InflectionPoint,
  LongHorizonResult,
  ResilienceResult,
  TrajectoryKind,
  YearSimulationPoint,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BCIE — system-scale evolution intelligence. Advises; never governs reality.
 */
export class CivilizationEngine {
  async create(input: CivilizationInput): Promise<CivilizationOutput> {
    return this.runCycle(input);
  }

  async simulate(input: CivilizationInput): Promise<CivilizationOutput> {
    return this.runCycle({ ...input, constraints: [...(input.constraints ?? []), "simulate"] });
  }

  async evolve(input: CivilizationInput): Promise<CivilizationOutput> {
    return this.runCycle({ ...input, seed: `${input.seed ?? input.blueprintId}:evolve:${Date.now()}` });
  }

  async forecast(input: CivilizationInput): Promise<LongHorizonResult> {
    const full = await this.runCycle(input);
    return full.forecast ?? longHorizonEngine.forecast(input.seed ?? input.blueprintId, full.trajectory, full.resilience);
  }

  async resilience(input: CivilizationInput): Promise<ResilienceResult> {
    const full = await this.runCycle(input);
    return (
      full.resilienceDetail ??
      civilResilience.measure(
        input.seed ?? input.blueprintId,
        full.ecosystem?.ecosystemHealth ?? 0.5,
        full.institutions?.institutionEffectiveness ?? 0.5,
        full.population?.populationHealth ?? 0.5,
      )
    );
  }

  async history(blueprintId: string, limit?: number) {
    return listCivilizationHistory(blueprintId, limit);
  }

  /** Simulate N years (1–100) and return yearly civilization snapshots. */
  async simulateYears(input: CivilizationInput, years: number): Promise<YearSimulationPoint[]> {
    const capped = Math.min(100, Math.max(1, Math.floor(years)));
    const baseSeed = input.seed ?? input.blueprintId;
    const series: YearSimulationPoint[] = [];

    for (let year = 0; year < capped; year++) {
      const out = await this.simulate({
        ...input,
        seed: `${baseSeed}:year-${year}`,
        constraints: [...(input.constraints ?? []), "simulate"],
      });
      const prev = series[year - 1];
      const momentum = this.momentumFromOutput(out, prev);
      series.push({
        year,
        population: out.civilizationState.population,
        institutions: out.civilizationState.institutions,
        economicOutput: out.civilEconomy?.production ?? 0,
        ecosystem: out.ecosystem?.ecosystemHealth ?? 0,
        resilience: out.resilience,
        momentum,
        trajectory: out.trajectory,
      });
    }

    return series;
  }

  async inflectionPoints(input: CivilizationInput, years = 25): Promise<InflectionPoint[]> {
    const series = await this.simulateYears(input, years);
    return longHorizonEngine.findInflectionPoints(series);
  }

  formatCivilizationContext(output: CivilizationOutput): string {
    return [
      `Civilization ${output.civilizationState.phase}: ${output.evolutionMode} · ${output.trajectory}`,
      `Resilience ${Math.round(output.resilience * 100)}%`,
      output.resilienceDetail ? `Score ${output.resilienceDetail.resilienceScore}/100` : "",
      output.recommendation.slice(0, 120),
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Advises only — block only collapsing civilizations with near-zero resilience. */
  async validateBeforeDecision(
    input: CivilizationInput,
  ): Promise<{ allowed: boolean; reason?: string; output?: CivilizationOutput }> {
    const output = await this.runCycle(input);
    if (output.evolutionMode === "collapsing" && output.resilience < 0.15) {
      return {
        allowed: false,
        reason: "Civilization trajectory collapsing — long-horizon stress before decision",
        output,
      };
    }
    return { allowed: true, output };
  }

  private async runCycle(input: CivilizationInput): Promise<CivilizationOutput> {
    const policy = civilizationPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Civilization policy violation: ${policy.violations.join("; ")}`);
    }

    const seed = input.seed ?? input.blueprintId;
    const sessionId = randomUUID();
    const civilizationId = input.civilizationId ?? randomUUID();

    const population = populationEngine.track(input, seed);
    const institutions = civilInstitutionEngine.simulate(input, seed);
    const ecosystem = ecosystemEngine.model(input, seed);
    const economy = civilEconomy.track(input, seed);
    const evolution = evolutionEngine.track(input, seed, population.populationHealth);
    const governance = civilGovernance.observe(input, seed);
    const resilienceDetail = civilResilience.measure(
      seed,
      ecosystem.ecosystemHealth,
      institutions.institutionEffectiveness,
      population.populationHealth,
    );

    const resilience = resilienceDetail.resilienceScore / 100;
    const trajectory = this.resolveTrajectory(economy.economicTrajectory, evolution.mode, ecosystem.systemRisk);
    const forecast = longHorizonEngine.forecast(seed, trajectory, resilience);

    const civilizationState: CivilizationState = {
      population: Math.round(population.populationHealth * 1000),
      institutions: Math.round(institutions.institutionEffectiveness * 10),
      markets: Math.round((input.world?.markets as number) ?? economy.production * 10),
      ecosystems: Math.round(ecosystem.ecosystemHealth * 10),
      phase: this.phaseFromMode(evolution.mode),
    };

    const recommendation = this.buildRecommendation(evolution.mode, trajectory, resilienceDetail, governance);

    const output: CivilizationOutput = {
      civilizationId,
      sessionId,
      civilizationState,
      resilience,
      trajectory,
      evolutionMode: evolution.mode,
      recommendation,
      population,
      institutions,
      ecosystem,
      civilEconomy: economy,
      evolution,
      governance,
      resilienceDetail,
      forecast,
    };

    civilizationMemory.store(input.blueprintId, output, seed);

    try {
      await persistCivilization(output, input.blueprintId, input.name ?? "Blueprint Civilization", seed, forecast);
    } catch (err) {
      logger.warn({ err, civilizationId }, "[CivilizationEngine] persist skipped");
    }

    return output;
  }

  private phaseFromMode(mode: string): string {
    if (mode === "expanding") return "scaling";
    if (mode === "fragile") return "stress";
    if (mode === "collapsing") return "decline";
    return "observe";
  }

  private resolveTrajectory(
    economic: TrajectoryKind,
    evolutionMode: string,
    systemRisk: number,
  ): TrajectoryKind {
    if (evolutionMode === "collapsing" || economic === "collapse") return "collapse";
    if (evolutionMode === "expanding" && economic === "growth") return "compound";
    if (systemRisk > 0.7) return "decline";
    return economic === "growth" ? "growth" : "stable";
  }

  private momentumFromOutput(
    out: CivilizationOutput,
    prev?: YearSimulationPoint,
  ): "growing" | "stable" | "declining" {
    if (!prev) {
      if (out.evolutionMode === "expanding") return "growing";
      if (out.evolutionMode === "collapsing" || out.evolutionMode === "fragile") return "declining";
      return "stable";
    }
    if (out.civilizationState.population > prev.population * 1.02) return "growing";
    if (out.civilizationState.population < prev.population * 0.98) return "declining";
    return "stable";
  }

  private buildRecommendation(
    mode: string,
    trajectory: TrajectoryKind,
    resilience: ResilienceResult,
    governance: { action: string },
  ): string {
    if (mode === "collapsing") {
      return "Advisory: system may collapse — strengthen institutions and ecosystem before scaling execution";
    }
    if (trajectory === "compound") {
      return `Advisory: compounding trajectory — ${governance.action} governance signals; resilience ${resilience.resilienceScore}/100`;
    }
    if (resilience.resilienceScore < 40) {
      return "Advisory: low civil resilience — stress-test institutions; do not optimize in isolation";
    }
    return `Advisory: civilization stable — forecast long-horizon outcomes (${trajectory})`;
  }
}

export const civilizationEngine = new CivilizationEngine();
