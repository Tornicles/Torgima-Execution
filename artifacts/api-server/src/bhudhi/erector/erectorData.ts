import {
  db,
  bhudhiSimulationWorlds,
  bhudhiSimulationRuns,
  bhudhiSimulationScores,
  bhudhiSimulationEvents,
  bhudhiSimulationMemory,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { Actor, EconomicResult, ErectorOutput, GeneratedWorld } from "./contracts/types.js";

export interface PersistSimulationParams {
  output: ErectorOutput;
  blueprintId: string;
  seed: string;
  goal: string;
  world: GeneratedWorld;
  mode: string;
  realism: number;
  difficulty: number;
  volatility: number;
  actors: Actor[];
  economy: EconomicResult;
  env: Record<string, unknown>;
}

export async function persistSimulationRun(params: PersistSimulationParams): Promise<void> {
  const { output, blueprintId, seed, goal, world, mode, realism, difficulty, volatility, actors, economy, env } =
    params;

  await db.insert(bhudhiSimulationWorlds).values({
    id: output.worldId,
    blueprint_id: blueprintId,
    mode,
    seed,
    world,
    realism,
    difficulty,
    volatility,
    memory_class: "ACTIVE",
  });

  await db.insert(bhudhiSimulationRuns).values({
    id: output.runId,
    simulation_id: output.simulationId,
    blueprint_id: blueprintId,
    world_id: output.worldId,
    goal,
    status: "complete",
    outcomes: output.outcomes,
    confidence: output.confidence,
    recommendation: output.recommendation,
    seed,
  });

  if (output.score) {
    const s = output.score;
    await db.insert(bhudhiSimulationScores).values({
      run_id: output.runId,
      survival: s.survival,
      goal_achievement: s.goalAchievement,
      efficiency: s.efficiency,
      resilience: s.resilience,
      risk: s.risk,
      overall: s.overall,
      confidence: s.confidence,
    });
  }

  for (const ev of output.outcomes.events) {
    await db.insert(bhudhiSimulationEvents).values({
      run_id: output.runId,
      event_type: ev.type,
      payload: { at: ev.at, detail: ev.detail },
    });
  }

  await db.insert(bhudhiSimulationMemory).values({
    blueprint_id: blueprintId,
    memory_type: "run",
    snapshot: {
      simulationId: output.simulationId,
      seed,
      actors,
      economy,
      environment: env,
      scenarios: output.scenarios,
    },
    memory_class: "ACTIVE",
  });
}

export async function listSimulationHistory(blueprintId: string, limit = 20) {
  const rows = await db
    .select()
    .from(bhudhiSimulationRuns)
    .where(eq(bhudhiSimulationRuns.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiSimulationRuns.created_at))
    .limit(limit);

  return rows.map((r) => ({
    simulationId: r.simulation_id,
    runId: r.id,
    goal: r.goal,
    confidence: r.confidence,
    recommendation: r.recommendation,
    status: r.status,
    createdAt: r.created_at,
  }));
}
