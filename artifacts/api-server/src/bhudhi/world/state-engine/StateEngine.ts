import type { StateDelta, StateKind, WorldEntity } from "../contracts/types.js";

export class StateEngine {
  computeDelta(before: Record<string, unknown>, after: Record<string, unknown>): StateDelta {
    const delta: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        delta[k] = { from: before[k], to: after[k] };
      }
    }
    return { before, after, delta };
  }

  classify(entity: WorldEntity): StateKind {
    if (entity.state.locked) return "LOCKED";
    if (entity.type === "EVENT" || entity.type === "RISK") return "VOLATILE";
    if (entity.type === "SYSTEM" || entity.type === "USER") return "STATIC";
    return "DYNAMIC";
  }

  transition(entity: WorldEntity, patch: Record<string, unknown>): WorldEntity {
    const before = { ...entity.state };
    const after = { ...entity.state, ...patch };
    const delta = this.computeDelta(before, after);
    return {
      ...entity,
      state: after,
      history: [
        ...entity.history,
        {
          at: new Date().toISOString(),
          change: `State change: ${Object.keys(delta.delta).join(", ") || "none"}`,
        },
      ],
    };
  }

  predict(entity: WorldEntity): Record<string, unknown> {
    const base = entity.state;
    if (entity.type === "GOAL") {
      return { ...base, projectedProgress: (Number(base.phaseProgress) || 0.5) + 0.05 };
    }
    if (entity.type === "SYSTEM") {
      return { ...base, global: base.global ?? "neutral" };
    }
    return base;
  }

  desired(entity: WorldEntity): Record<string, unknown> {
    if (entity.type === "GOAL") return { phase: "complete", health: 1 };
    if (entity.type === "TASK") return { status: "done" };
    return entity.state;
  }
}

export const stateEngine = new StateEngine();
