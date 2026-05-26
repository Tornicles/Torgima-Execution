import type { WorldEntity, WorldRelationship } from "../contracts/types.js";

export class WorldPrediction {
  predict(entities: WorldEntity[], relationships: WorldRelationship[]): { next: string; confidence: number } {
    const goal = entities.find((e) => e.type === "GOAL");
    const risks = entities.filter((e) => e.type === "RISK");
    const blocked = relationships.filter((r) => r.type === "blocks");

    if (blocked.length > 0 && risks.length > 0) {
      return {
        next: "Progress constrained — resolve blocking relationships first",
        confidence: 0.72,
      };
    }

    if (goal) {
      return {
        next: `Goal "${goal.label}" advances with ${entities.length} connected entities`,
        confidence: 0.65,
      };
    }

    return { next: "World state stable — monitor signal drift", confidence: 0.5 };
  }
}

export const worldPrediction = new WorldPrediction();
