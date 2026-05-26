import type { ComposedCapability, DiscoveredCapability } from "../contracts/types.js";

const BASE_SKILLS = ["validate", "decide", "simulate", "execute", "learn"];

export class CapabilityComposer {
  compose(candidates: DiscoveredCapability[]): ComposedCapability[] {
    return candidates.slice(0, 3).map((c, i) => {
      const deps = BASE_SKILLS.filter((_, idx) => idx <= i);
      return {
        newCapability: `composed:${c.capability}`,
        dependencies: [...deps, c.origin],
      };
    });
  }
}

export const capabilityComposer = new CapabilityComposer();
