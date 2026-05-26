import { randomUUID } from "node:crypto";
import { entityGraph } from "../entity-engine/EntityGraph.js";
import { stateEngine } from "../state-engine/StateEngine.js";
import { relationshipEngine } from "../relationship-engine/RelationshipEngine.js";
import { causalityEngine } from "../causality/CausalityEngine.js";
import { timelineEngine } from "../timeline/TimelineEngine.js";
import { constraintEngine } from "../constraints/ConstraintEngine.js";
import { realitySync } from "../reality-sync/RealitySync.js";
import { counterfactualEngine } from "../counterfactual/CounterfactualEngine.js";
import { worldPrediction } from "../prediction/WorldPrediction.js";
import { worldPolicy } from "../policy/WorldPolicy.js";
import { worldMemory } from "../world-memory/WorldMemory.js";
import { persistWorldSession, persistEntityState, listWorldSnapshots, listWorldEntities } from "../worldData.js";
import type { WorldInput, WorldOutput, WorldState } from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BWME — unified reality layer. World model is reality; everything else is interpretation.
 */
export class WorldEngine {
  async sync(input: WorldInput): Promise<WorldOutput> {
    const sessionId = randomUUID();

    const policy = worldPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`World policy violation: ${policy.violations.join("; ")}`);
    }

    let entities = entityGraph.buildFromInput(input);
    const relationships = relationshipEngine.infer(entities);

    const changes: string[] = [];
    entities = entities.map((e) => {
      const kind = stateEngine.classify(e);
      const predicted = stateEngine.predict(e);
      const desired = stateEngine.desired(e);
      const after = { ...e.state, stateKind: kind, predicted, desired };
      const delta = stateEngine.computeDelta(e.state, after);
      if (Object.keys(delta.delta).length > 0) {
        changes.push(`${e.type}:${e.label} updated`);
      }
      return stateEngine.transition(e, after);
    });

    const constraints = constraintEngine.evaluate(input);
    if (!constraints.allowed) {
      changes.push(`Blocked: ${constraints.blocked.join(", ")}`);
    }

    const syncResult = realitySync.sync(input, "live");
    if (syncResult.drift) changes.push("Reality drift detected");
    if (syncResult.stale) changes.push("Stale sources detected");

    const causeTree = causalityEngine.buildCauseTree(input);
    const events = [
      {
        eventId: randomUUID(),
        type: "WORLD_SYNC",
        cause: causeTree.cause,
        impact: causeTree.impact,
      },
    ];

    const timeline = timelineEngine.forecast(input.blueprintId);
    const prediction = worldPrediction.predict(entities, relationships);

    const confidence = Math.min(
      0.95,
      0.4 +
        entities.length * 0.03 +
        (syncResult.conflicts === 0 ? 0.15 : 0) +
        (constraints.allowed ? 0.1 : 0),
    );

    const worldState: WorldState = {
      sessionId,
      version: (timelineEngine.latest(input.blueprintId)?.version ?? 0) + 1,
      entities,
      relationships,
      events,
      constraints,
      timeline,
    };

    timelineEngine.commit(input.blueprintId, worldState);
    worldMemory.store(input.blueprintId, worldState);

    const output: WorldOutput = {
      worldState,
      confidence,
      changes,
      prediction,
      sync: {
        drift: syncResult.drift,
        stale: syncResult.stale,
        conflicts: syncResult.conflicts,
      },
    };

    try {
      await persistWorldSession(output, {
        blueprintId: input.blueprintId,
        userId: input.userId,
      });
      for (const e of entities.slice(0, 5)) {
        const delta = stateEngine.computeDelta({}, e.state);
        await persistEntityState(input.blueprintId, e.entityId, delta, stateEngine.classify(e));
      }
    } catch (err) {
      logger.warn({ err, sessionId }, "[WorldEngine] persist skipped");
    }

    return output;
  }

  formatWorldContext(output: WorldOutput): string {
    const ws = output.worldState;
    return [
      `World v${ws.version} (${ws.sessionId.slice(0, 8)})`,
      `Entities: ${ws.entities.length} | Relationships: ${ws.relationships.length}`,
      `Changes: ${output.changes.slice(0, 4).join("; ") || "none"}`,
      `Constraints: ${ws.constraints.allowed ? "allowed" : `blocked (${ws.constraints.blocked.join(",")})`}`,
      output.prediction ? `Next: ${output.prediction.next}` : "",
      output.sync?.drift ? "⚠ reality drift" : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async addEntity(
    blueprintId: string,
    type: WorldState["entities"][0]["type"],
    label: string,
    state: Record<string, unknown> = {},
  ) {
    const entity = entityGraph.create(type, label, state);
    await this.sync({
      blueprintId,
      blueprint: { title: label },
      trigger: "ENTITY_CREATE",
    });
    return entity;
  }

  async updateState(blueprintId: string, entityId: string, patch: Record<string, unknown>) {
    const entities = await listWorldEntities(blueprintId);
    const found = entities.find((e) => e.entityId === entityId);
    if (!found) return null;
    const entity = {
      entityId: found.entityId,
      type: found.type as WorldState["entities"][0]["type"],
      label: found.label,
      state: found.state as Record<string, unknown>,
      relationships: (found.relationships as string[]) ?? [],
      history: [],
    };
    const updated = stateEngine.transition(entity, patch);
    const delta = stateEngine.computeDelta(entity.state, updated.state);
    await persistEntityState(blueprintId, entityId, delta, stateEngine.classify(updated));
    return updated;
  }

  async addRelationship(
    blueprintId: string,
    fromEntityId: string,
    toEntityId: string,
    type: WorldState["relationships"][0]["type"],
  ) {
    return relationshipEngine.link(fromEntityId, toEntityId, type, 1);
  }

  async predict(blueprintId: string) {
    const cached = worldMemory.get(blueprintId);
    if (!cached) {
      return worldPrediction.predict([], []);
    }
    return worldPrediction.predict(cached.entities, cached.relationships);
  }

  async branch(blueprintId: string, scenario: string, fromVersion?: number) {
    const version = fromVersion ?? timelineEngine.latest(blueprintId)?.version ?? 1;
    const branched = timelineEngine.branch(blueprintId, version);
    const counterfactuals = counterfactualEngine.generate(scenario);
    const branchNarrative = counterfactualEngine.branch(scenario);
    return { snapshot: branched, scenarios: counterfactuals, ...branchNarrative };
  }

  async snapshots(blueprintId: string, limit?: number) {
    return listWorldSnapshots(blueprintId, limit);
  }

  async entities(blueprintId: string, limit?: number) {
    return listWorldEntities(blueprintId, limit);
  }
}

export const worldEngine = new WorldEngine();
