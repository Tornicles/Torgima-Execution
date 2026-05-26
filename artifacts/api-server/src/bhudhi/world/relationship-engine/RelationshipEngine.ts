import { randomUUID } from "node:crypto";
import type { RelationType, WorldEntity, WorldRelationship } from "../contracts/types.js";

export class RelationshipEngine {
  infer(entities: WorldEntity[]): WorldRelationship[] {
    const rels: WorldRelationship[] = [];
    const byType = new Map<string, WorldEntity[]>();
    for (const e of entities) {
      const list = byType.get(e.type) ?? [];
      list.push(e);
      byType.set(e.type, list);
    }

    const goal = byType.get("GOAL")?.[0];
    const user = byType.get("USER")?.[0];
    const agent = byType.get("AGENT")?.[0];
    const project = byType.get("PROJECT")?.[0];
    const system = byType.get("SYSTEM")?.[0];
    const risk = byType.get("RISK")?.[0];
    const task = byType.get("TASK")?.[0];

    if (goal && user) rels.push(this.link(user.entityId, goal.entityId, "supports", 1));
    if (goal && project) rels.push(this.link(project.entityId, goal.entityId, "depends_on", 1));
    if (agent && goal) rels.push(this.link(agent.entityId, goal.entityId, "influences", 0.8));
    if (system && goal) rels.push(this.link(system.entityId, goal.entityId, "influences", 0.7));
    if (risk && goal) rels.push(this.link(risk.entityId, goal.entityId, "blocks", 0.6));
    if (task && goal) rels.push(this.link(task.entityId, goal.entityId, "supports", 0.9));

    for (const e of entities) {
      for (const rid of e.relationships) {
        if (!rels.some((r) => r.fromEntityId === e.entityId && r.toEntityId === rid)) {
          rels.push(this.link(e.entityId, rid, "influences", 0.5));
        }
      }
    }

    return rels;
  }

  link(from: string, to: string, type: RelationType, weight: number): WorldRelationship {
    return { id: randomUUID(), fromEntityId: from, toEntityId: to, type, weight };
  }

  propagate(rels: WorldRelationship[], changedEntityId: string): string[] {
    const affected = new Set<string>([changedEntityId]);
    let added = true;
    while (added) {
      added = false;
      for (const r of rels) {
        if (affected.has(r.fromEntityId) && !affected.has(r.toEntityId)) {
          affected.add(r.toEntityId);
          added = true;
        }
        if (r.type === "blocks" && affected.has(r.toEntityId) && !affected.has(r.fromEntityId)) {
          affected.add(r.fromEntityId);
          added = true;
        }
      }
    }
    return [...affected];
  }
}

export const relationshipEngine = new RelationshipEngine();
