import type { GeneratedWorld } from "../contracts/types.js";
import { seededUnit } from "../lib/seededRandom.js";

export class InstitutionEngine {
  pressure(world: GeneratedWorld, seed: string): number {
    const governance = world.systems.find((s) => s.id === "governance");
    const strict = governance?.strict === true ? 0.15 : 0;
    return Math.min(1, seededUnit(seed, "inst") * 0.5 + strict + ((world.organization.capacity as number) ?? 0.5) * 0.2);
  }
}

export const institutionEngine = new InstitutionEngine();
