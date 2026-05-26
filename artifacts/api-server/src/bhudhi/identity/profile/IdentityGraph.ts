import { randomUUID } from "node:crypto";
import type { IdentityEdge, IdentityInput, IdentityNode } from "../contracts/types.js";

export class IdentityGraph {
  build(input: IdentityInput): { nodes: IdentityNode[]; edges: IdentityEdge[] } {
    const nodes: IdentityNode[] = [];
    const edges: IdentityEdge[] = [];

    const values = this.node("values", "Core values", 0.9);
    const goals = this.node("goals", "Active goals", 0.85);
    const habits = this.node("habits", "Execution habits", 0.7);
    const beliefs = this.node("beliefs", "Epistemic beliefs", 0.75);
    const motivations = this.node("motivations", "Motivation drivers", 0.8);
    const capabilities = this.node("capabilities", "Capability stack", 0.72);
    nodes.push(values, goals, habits, beliefs, motivations, capabilities);

    edges.push(
      { from: values.id, to: goals.id, type: "reinforces" },
      { from: motivations.id, to: goals.id, type: "reinforces" },
      { from: capabilities.id, to: goals.id, type: "depends_on" },
      { from: habits.id, to: goals.id, type: "reinforces" },
      { from: beliefs.id, to: goals.id, type: "influences" },
    );

    if (input.feedback?.negative === true) {
      edges.push({ from: habits.id, to: motivations.id, type: "weakens" });
    }

    if (input.world && (input.world as Record<string, unknown>).constraints) {
      const constraints = (input.world as Record<string, unknown>).constraints as { blocked?: string[] };
      if (constraints.blocked?.length) {
        edges.push({ from: goals.id, to: values.id, type: "conflicts" });
      }
    }

    if (input.execution?.status === "completed") {
      edges.push({ from: goals.id, to: capabilities.id, type: "transforms" });
    }

    return { nodes, edges };
  }

  private node(kind: IdentityNode["kind"], label: string, weight: number): IdentityNode {
    return { id: randomUUID(), kind, label, weight };
  }
}

export const identityGraph = new IdentityGraph();
