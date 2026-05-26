import type { MemoryClass, TeamOutput } from "../contracts/types.js";

interface Entry {
  output: TeamOutput;
  snapshots: Array<{ type: string; content: Record<string, unknown> }>;
  class: MemoryClass;
}

const store = new Map<string, Entry>();

export class TeamMemory {
  store(teamId: string, output: TeamOutput): void {
    const existing = store.get(teamId);
    const snapshots = existing?.snapshots ?? [];
    if (output.consensus) {
      snapshots.push({ type: "decision", content: { decision: output.consensus.decision } });
    }
    store.set(teamId, { output, snapshots, class: "ACTIVE" });
  }

  get(teamId: string): TeamOutput | null {
    const e = store.get(teamId);
    if (!e || e.class === "SEALED") return null;
    return e.output;
  }

  recall(teamId: string): Array<{ type: string; content: Record<string, unknown> }> {
    return store.get(teamId)?.snapshots ?? [];
  }
}

export const teamMemory = new TeamMemory();
