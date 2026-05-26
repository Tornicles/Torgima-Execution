import { randomUUID } from "node:crypto";
import type { OrgEdge, OrgInput, OrgNode } from "../contracts/types.js";

export class OrganizationGraph {
  build(input: OrgInput, orgId: string, orgName: string): { nodes: OrgNode[]; edges: OrgEdge[] } {
    const nodes: OrgNode[] = [];
    const edges: OrgEdge[] = [];

    const org = this.node("organization", orgName, { organizationId: orgId });
    nodes.push(org);

    const goal = this.node("goal", input.strategy?.vision ? String(input.strategy.vision) : "Primary objective", {});
    nodes.push(goal);
    edges.push({ from: org.id, to: goal.id, type: "owns" });

    for (const u of input.users ?? []) {
      const user = this.node("user", u.userId.slice(0, 8), { userId: u.userId });
      nodes.push(user);
      edges.push({ from: user.id, to: org.id, type: "reports_to" });

      const role = this.node("role", u.role ?? "member", { department: u.department });
      nodes.push(role);
      edges.push({ from: user.id, to: role.id, type: "owns" });
      edges.push({ from: role.id, to: goal.id, type: "supports" });
    }

    if ((input.users ?? []).length === 0 && input.roles?.length) {
      for (const r of input.roles) {
        const role = this.node("role", r.roleKey, { authority: r.authority });
        nodes.push(role);
        edges.push({ from: role.id, to: org.id, type: "reports_to" });
      }
    }

    const team = this.node("team", "Core team", {});
    nodes.push(team);
    edges.push({ from: org.id, to: team.id, type: "owns" });

    for (const p of input.projects ?? []) {
      const project = this.node("project", p.name, { projectId: p.id, status: p.status });
      nodes.push(project);
      edges.push({ from: team.id, to: project.id, type: "owns" });
      edges.push({ from: project.id, to: goal.id, type: "depends_on" });
      if (p.ownerId) {
        const owner = nodes.find((n) => n.metadata?.userId === p.ownerId);
        if (owner) edges.push({ from: owner.id, to: project.id, type: "owns" });
      }
    }

    const resource = this.node("resource", "Shared capacity", { blueprintId: input.blueprintId });
    nodes.push(resource);
    edges.push({ from: org.id, to: resource.id, type: "supports" });

    return { nodes, edges };
  }

  private node(kind: OrgNode["kind"], label: string, metadata: Record<string, unknown>): OrgNode {
    return { id: randomUUID(), kind, label, metadata };
  }
}

export const organizationGraph = new OrganizationGraph();
