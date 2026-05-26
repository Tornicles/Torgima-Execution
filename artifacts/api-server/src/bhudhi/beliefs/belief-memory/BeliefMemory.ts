import type { BeliefRecord, MemoryClass } from "../contracts/types.js";

const cache = new Map<string, BeliefRecord[]>();

export class BeliefMemory {
  key(blueprintId: string): string {
    return blueprintId;
  }

  getActive(blueprintId: string): BeliefRecord[] {
    return (cache.get(this.key(blueprintId)) ?? []).filter(
      (r) => (r.memoryClass ?? "ACTIVE") === "ACTIVE",
    );
  }

  store(blueprintId: string, records: BeliefRecord[], memoryClass: MemoryClass = "ACTIVE"): void {
    const tagged = records.map((r) => ({ ...r, memoryClass }));
    cache.set(this.key(blueprintId), tagged);
  }

  archive(blueprintId: string): void {
    const existing = cache.get(this.key(blueprintId)) ?? [];
    cache.set(
      this.key(blueprintId),
      existing.map((r) => ({ ...r, memoryClass: "ARCHIVE" as MemoryClass })),
    );
  }

  expire(beliefId: string, blueprintId: string): void {
    const existing = cache.get(this.key(blueprintId)) ?? [];
    cache.set(
      this.key(blueprintId),
      existing.map((r) =>
        r.beliefId === beliefId ? { ...r, memoryClass: "EXPIRED" as MemoryClass, state: "DEPRECATED" } : r,
      ),
    );
  }
}

export const beliefMemory = new BeliefMemory();
