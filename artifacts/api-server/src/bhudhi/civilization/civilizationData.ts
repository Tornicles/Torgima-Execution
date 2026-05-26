import {
  db,
  bhudhiCivilizations,
  bhudhiCivilizationStates,
  bhudhiCivilizationEvents,
  bhudhiCivilizationForecasts,
  bhudhiCivilizationMemory,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { CivilizationOutput, LongHorizonResult } from "./contracts/types.js";

export async function persistCivilization(
  output: CivilizationOutput,
  blueprintId: string,
  name: string,
  seed: string,
  forecast: LongHorizonResult,
): Promise<void> {
  await db.insert(bhudhiCivilizations).values({
    id: output.civilizationId,
    blueprint_id: blueprintId,
    name,
    civilization_state: output.civilizationState,
    resilience: output.resilience,
    trajectory: output.trajectory,
    evolution_mode: output.evolutionMode,
    seed,
    memory_class: "ACTIVE",
  });

  await db.insert(bhudhiCivilizationStates).values({
    civilization_id: output.civilizationId,
    phase: output.civilizationState.phase,
    population_health: output.population?.populationHealth ?? 0.5,
    institution_effectiveness: output.institutions?.institutionEffectiveness ?? 0.5,
    ecosystem_health: output.ecosystem?.ecosystemHealth ?? 0.5,
    economic_trajectory: output.civilEconomy?.economicTrajectory ?? "stable",
    resilience_score: output.resilienceDetail?.resilienceScore ?? 50,
    snapshot: {
      evolution: output.evolution,
      governance: output.governance,
      ecosystem: output.ecosystem,
    },
  });

  await db.insert(bhudhiCivilizationEvents).values({
    civilization_id: output.civilizationId,
    event_type: "cycle_complete",
    payload: { trajectory: output.trajectory, evolutionMode: output.evolutionMode },
  });

  for (const h of forecast.horizons) {
    await db.insert(bhudhiCivilizationForecasts).values({
      civilization_id: output.civilizationId,
      horizon_years: h.horizonYears,
      trajectory: h.trajectory,
      confidence: h.confidence,
      forecast: h,
    });
  }

  await db.insert(bhudhiCivilizationMemory).values({
    blueprint_id: blueprintId,
    civilization_id: output.civilizationId,
    memory_type: "cycle",
    snapshot: output,
    memory_class: "ACTIVE",
  });
}

export async function listCivilizations(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiCivilizations)
    .where(eq(bhudhiCivilizations.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiCivilizations.updated_at))
    .limit(limit);

  return rows.map((r) => {
    const state = r.civilization_state as { population?: number; institutions?: number } | null;
    return {
      id: r.id,
      name: r.name,
      population: state?.population ?? 0,
      institutions: state?.institutions ?? 0,
      resilience: r.resilience,
      trajectory: r.trajectory,
      evolutionMode: r.evolution_mode,
      updatedAt: r.updated_at,
    };
  });
}

export async function listCivilizationHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiCivilizations)
    .where(eq(bhudhiCivilizations.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiCivilizations.updated_at))
    .limit(limit);

  return rows.map((r) => ({
    civilizationId: r.id,
    name: r.name,
    resilience: r.resilience,
    trajectory: r.trajectory,
    evolutionMode: r.evolution_mode,
    updatedAt: r.updated_at,
  }));
}
