import { randomUUID } from "node:crypto";
import type { WorldState } from "../contracts/types.js";

export interface WorldSnapshot {
  snapshotId: string;
  version: number;
  worldState: WorldState;
  createdAt: string;
}

const snapshotStore = new Map<string, WorldSnapshot[]>();

export class TimelineEngine {
  key(blueprintId: string): string {
    return blueprintId;
  }

  commit(blueprintId: string, worldState: WorldState): WorldSnapshot {
    const list = snapshotStore.get(this.key(blueprintId)) ?? [];
    const version = list.length + 1;
    const snap: WorldSnapshot = {
      snapshotId: randomUUID(),
      version,
      worldState: { ...worldState, version },
      createdAt: new Date().toISOString(),
    };
    list.push(snap);
    snapshotStore.set(this.key(blueprintId), list);
    return snap;
  }

  latest(blueprintId: string): WorldSnapshot | null {
    const list = snapshotStore.get(this.key(blueprintId)) ?? [];
    return list[list.length - 1] ?? null;
  }

  rollback(blueprintId: string, version: number): WorldSnapshot | null {
    const list = snapshotStore.get(this.key(blueprintId)) ?? [];
    const snap = list.find((s) => s.version === version);
    return snap ?? null;
  }

  branch(blueprintId: string, fromVersion: number): WorldSnapshot | null {
    const snap = this.rollback(blueprintId, fromVersion);
    if (!snap) return null;
    return this.commit(blueprintId, {
      ...snap.worldState,
      sessionId: randomUUID(),
    });
  }

  forecast(blueprintId: string): { past: number; current: number; future: number } {
    const list = snapshotStore.get(this.key(blueprintId)) ?? [];
    return {
      past: Math.max(0, list.length - 1),
      current: list.length,
      future: list.length > 0 ? list.length + 2 : 1,
    };
  }

  replay(blueprintId: string, version: number): WorldState | null {
    const snap = this.rollback(blueprintId, version);
    return snap?.worldState ?? null;
  }
}

export const timelineEngine = new TimelineEngine();
