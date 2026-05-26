import type { OrgInput, TeamSyncResult } from "../contracts/types.js";

export class TeamSync {
  detect(input: OrgInput): TeamSyncResult {
    const issues: string[] = [];
    const actions: string[] = [];

    const projects = input.projects ?? [];
    const owners = new Set(projects.map((p) => p.ownerId).filter(Boolean));
    if (projects.length > 1 && owners.size < projects.length) {
      issues.push("duplication");
      actions.push("clarify_ownership");
    }

    if (input.signals?.global === "danger" && input.identity?.burnout) {
      issues.push("misalignment");
      actions.push("recover");
    }

    const names = projects.map((p) => p.name.toLowerCase());
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) {
      issues.push("conflict");
      actions.push("merge_duplicates");
    }

    if ((input.execution?.bottleneck as string)) {
      issues.push("bottleneck");
      actions.push("rebalance_capacity");
    }

    const syncScore = Math.max(0, 1 - issues.length * 0.2);
    return { syncScore, issues, actions };
  }
}

export const teamSync = new TeamSync();
