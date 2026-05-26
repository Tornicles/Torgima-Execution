import type { Actor, GeneratedWorld } from "../contracts/types.js";
import { seededUnit } from "../lib/seededRandom.js";

export class ActorEngine {
  spawn(world: GeneratedWorld, seed: string): Actor[] {
    const actors: Actor[] = [
      {
        id: "user-lead",
        kind: "user",
        goals: ["ship goal", "maintain quality"],
        beliefs: ["execution matters"],
        resources: { time: 40, budget: (world.resources.budget as number) ?? 50 },
        behavior: "decisive",
      },
      {
        id: "team-core",
        kind: "team",
        goals: ["coordinate delivery"],
        beliefs: ["alignment first"],
        resources: { capacity: (world.organization.capacity as number) ?? 0.7 },
        behavior: "collaborative",
      },
      {
        id: "customer-1",
        kind: "customer",
        goals: ["receive value"],
        beliefs: ["speed and trust"],
        resources: { attention: seededUnit(seed, "cust") },
        behavior: "demanding",
      },
      {
        id: "competitor-1",
        kind: "competitor",
        goals: ["capture share"],
        beliefs: ["move fast"],
        resources: { pressure: (world.market.competition as number) ?? 0.3 },
        behavior: "aggressive",
      },
      {
        id: "agent-bhudhi",
        kind: "agent",
        goals: ["assist execution"],
        beliefs: ["simulate before act"],
        resources: { compute: 20 },
        behavior: "advisory",
      },
    ];
    return actors;
  }
}

export const actorEngine = new ActorEngine();
