import type { MemoryClass, WorldState } from "../contracts/types.js";

const cache = new Map<string, { state: WorldState; memoryClass: MemoryClass }>();

export class WorldMemory {
  store(blueprintId: string, state: WorldState, memoryClass: MemoryClass = "ACTIVE"): void {
    cache.set(blueprintId, { state, memoryClass });
  }

  get(blueprintId: string): WorldState | null {
    const entry = cache.get(blueprintId);
    if (!entry || entry.memoryClass === "SEALED") return entry?.state ?? null;
    return entry.state;
  }

  archive(blueprintId: string): void {
    const entry = cache.get(blueprintId);
    if (entry) cache.set(blueprintId, { ...entry, memoryClass: "ARCHIVE" });
  }
}

export const worldMemory = new WorldMemory();
