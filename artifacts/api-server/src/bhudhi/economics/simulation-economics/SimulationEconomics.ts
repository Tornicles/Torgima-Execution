import type { SimulationMode } from "../contracts/types.js";

export interface SimulationEconomicsResult {
  mode: SimulationMode;
  npcCount: number;
  worldSize: number;
  timelineDepth: number;
  agentCount: number;
  computeCostUsd: number;
  valueRatio: number;
}

export class SimulationEconomics {
  plan(
    simulationValue: number,
    budgetUsd: number,
    priority: "low" | "normal" | "high" | "critical" = "normal",
  ): SimulationEconomicsResult {
    let mode: SimulationMode = "NORMAL";
    if (budgetUsd < 0.05 || priority === "low") mode = "FAST";
    else if (priority === "critical" && budgetUsd > 0.5) mode = "STRATEGIC";
    else if (budgetUsd > 2) mode = "FULL_WORLD";

    const params = {
      FAST: { npc: 5, world: 1, depth: 3, agents: 1, cost: 0.02 },
      NORMAL: { npc: 15, world: 2, depth: 7, agents: 2, cost: 0.08 },
      STRATEGIC: { npc: 40, world: 4, depth: 14, agents: 4, cost: 0.25 },
      "FULL_WORLD": { npc: 100, world: 8, depth: 30, agents: 8, cost: 0.8 },
    }[mode];

    let adjusted = { ...params };
    const ratio = params.cost > 0 ? simulationValue / params.cost : 0;
    if (ratio < 2 && mode !== "FAST") {
      mode = mode === "FULL_WORLD" ? "STRATEGIC" : mode === "STRATEGIC" ? "NORMAL" : "FAST";
      adjusted = {
        FAST: { npc: 5, world: 1, depth: 3, agents: 1, cost: 0.02 },
        NORMAL: { npc: 15, world: 2, depth: 7, agents: 2, cost: 0.08 },
        STRATEGIC: { npc: 40, world: 4, depth: 14, agents: 4, cost: 0.25 },
        "FULL_WORLD": { npc: 100, world: 8, depth: 30, agents: 8, cost: 0.8 },
      }[mode];
    }

    const finalRatio = adjusted.cost > 0 ? simulationValue / adjusted.cost : 0;

    return {
      mode,
      npcCount: adjusted.npc,
      worldSize: adjusted.world,
      timelineDepth: adjusted.depth,
      agentCount: adjusted.agents,
      computeCostUsd: adjusted.cost,
      valueRatio: finalRatio,
    };
  }
}

export const simulationEconomics = new SimulationEconomics();
