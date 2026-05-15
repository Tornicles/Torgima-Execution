import type { BlueprintOperationalState } from "./blueprint-types.js";

export interface GraphNode {
  id: string;
  layer: string;
  label: string;
  status: string;
  risk: "low" | "medium" | "high";
  parentId: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: "hierarchy" | "dependency" | "signal" | "adaptation";
}

export interface OperationalGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  operationalState: BlueprintOperationalState;
}

export function buildOperationalGraph(params: {
  goal: string;
  plans: Array<{ id: string; name: string; status: string }>;
  targets: Array<{ id: string; name: string; status: string; planId: string | null }>;
  phases: Array<{ id: string; name: string; status: string; targetId: string | null }>;
  projects: Array<{ id: string; name: string; status: string; phaseId: string | null }>;
  actions: Array<{ id: string; name: string; status: string; projectId: string }>;
  dependencies: Array<{ blockingId: string; blockedId: string }>;
  operationalState: BlueprintOperationalState;
}): OperationalGraph {
  const nodes: GraphNode[] = [
    {
      id: "goal",
      layer: "goal",
      label: params.goal.slice(0, 80),
      status: "active",
      risk: "low",
      parentId: null,
    },
  ];
  const edges: GraphEdge[] = [];

  for (const p of params.plans) {
    nodes.push({
      id: p.id,
      layer: "plan",
      label: p.name,
      status: p.status,
      risk: p.status === "pending" ? "medium" : "low",
      parentId: "goal",
    });
    edges.push({ from: "goal", to: p.id, relation: "hierarchy" });
  }

  for (const t of params.targets) {
    nodes.push({
      id: t.id,
      layer: "target",
      label: t.name,
      status: t.status,
      risk: t.status === "at_risk" ? "high" : "low",
      parentId: t.planId,
    });
    if (t.planId) edges.push({ from: t.planId, to: t.id, relation: "hierarchy" });
  }

  for (const ph of params.phases) {
    nodes.push({
      id: ph.id,
      layer: "phase",
      label: ph.name,
      status: ph.status,
      risk: ph.status === "blocked" ? "high" : "medium",
      parentId: ph.targetId,
    });
    if (ph.targetId) edges.push({ from: ph.targetId, to: ph.id, relation: "hierarchy" });
  }

  for (const pr of params.projects) {
    nodes.push({
      id: pr.id,
      layer: "project",
      label: pr.name,
      status: pr.status,
      risk: pr.status === "blocked" ? "high" : "low",
      parentId: pr.phaseId,
    });
    if (pr.phaseId) edges.push({ from: pr.phaseId, to: pr.id, relation: "hierarchy" });
  }

  for (const a of params.actions) {
    nodes.push({
      id: a.id,
      layer: "action",
      label: a.name,
      status: a.status,
      risk: "low",
      parentId: a.projectId,
    });
    edges.push({ from: a.projectId, to: a.id, relation: "hierarchy" });
  }

  for (const d of params.dependencies) {
    edges.push({ from: d.blockingId, to: d.blockedId, relation: "dependency" });
  }

  return { nodes, edges, operationalState: params.operationalState };
}
