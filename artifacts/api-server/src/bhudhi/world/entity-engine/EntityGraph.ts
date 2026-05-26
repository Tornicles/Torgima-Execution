import { randomUUID } from "node:crypto";
import type { EntityType, WorldEntity, WorldInput } from "../contracts/types.js";

export class EntityGraph {
  buildFromInput(input: WorldInput): WorldEntity[] {
    const now = new Date().toISOString();
    const entities: WorldEntity[] = [];

    if (input.userId) {
      entities.push(this.create("USER", "User", { userId: input.userId }, []));
    }

    const goalLabel =
      typeof input.blueprint?.title === "string"
        ? input.blueprint.title
        : typeof input.blueprint?.goal === "string"
          ? input.blueprint.goal
          : "Primary goal";

    const goal = this.create("GOAL", goalLabel, {
      blueprintId: input.blueprintId,
      phase: input.blueprint?.phase ?? "active",
    });
    entities.push(goal);

    if (input.signals) {
      const signal = this.create("SYSTEM", "Signal layer", {
        global: input.signals.global ?? "neutral",
        confidence: input.signals.confidence ?? 0.5,
      });
      entities.push(signal);
      goal.relationships.push(signal.entityId);
      signal.relationships.push(goal.entityId);
    }

    if (input.conditions && Object.keys(input.conditions).length > 0) {
      entities.push(
        this.create("RISK", "Condition constraints", {
          keys: Object.keys(input.conditions).slice(0, 8),
        }),
      );
    }

    if (input.simulation) {
      entities.push(
        this.create("EVENT", "Simulation branch", {
          active: true,
          at: now,
        }),
      );
    }

    if (input.execution) {
      entities.push(
        this.create("TASK", "Execution activity", {
          status: input.execution.status ?? "running",
        }),
      );
    }

    if (input.feedback) {
      entities.push(
        this.create("EVENT", "Feedback event", {
          received: true,
          at: now,
        }),
      );
    }

    entities.push(
      this.create("AGENT", "Bhudhi intelligence", {
        trigger: input.trigger ?? "UNKNOWN",
      }),
    );

    entities.push(
      this.create("PROJECT", "Blueprint project", {
        blueprintId: input.blueprintId,
      }),
    );

    return entities;
  }

  create(
    type: EntityType,
    label: string,
    state: Record<string, unknown>,
    relationships: string[] = [],
  ): WorldEntity {
    return {
      entityId: randomUUID(),
      type,
      label,
      state,
      relationships,
      history: [{ at: new Date().toISOString(), change: `Created ${type}` }],
    };
  }

  merge(a: WorldEntity, b: WorldEntity): WorldEntity {
    return {
      ...a,
      label: `${a.label} + ${b.label}`,
      state: { ...a.state, ...b.state },
      relationships: [...new Set([...a.relationships, ...b.relationships, b.entityId])],
      history: [
        ...a.history,
        { at: new Date().toISOString(), change: `Merged with ${b.entityId}` },
      ],
    };
  }
}

export const entityGraph = new EntityGraph();
