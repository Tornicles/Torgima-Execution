import type { CivilizationOutput } from "../contracts/types.js";

interface Entry {
  output: CivilizationOutput;
  seed: string;
}

const byBlueprint = new Map<string, Entry[]>();
const byId = new Map<string, CivilizationOutput>();

export class CivilizationMemory {
  store(blueprintId: string, output: CivilizationOutput, seed: string): void {
    byId.set(output.civilizationId, output);
    const list = byBlueprint.get(blueprintId) ?? [];
    list.push({ output, seed });
    byBlueprint.set(blueprintId, list.slice(-25));
  }

  get(civilizationId: string): CivilizationOutput | null {
    return byId.get(civilizationId) ?? null;
  }

  list(blueprintId: string): CivilizationOutput[] {
    return (byBlueprint.get(blueprintId) ?? []).map((e) => e.output);
  }
}

export const civilizationMemory = new CivilizationMemory();
