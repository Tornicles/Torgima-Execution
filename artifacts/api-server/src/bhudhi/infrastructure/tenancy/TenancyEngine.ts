import type { InfrastructureInput, TenancyMode } from "../contracts/types.js";

const PROTECTED = ["memory", "execution", "data", "agents"];

export class TenancyEngine {
  evaluate(input: InfrastructureInput): { mode: TenancyMode; isolated: boolean; violations: string[] } {
    const mode = input.tenancyMode ?? "multi";
    const violations: string[] = [];

    if (input.execution?.crossTenant === true) {
      violations.push("Cross-tenant access blocked");
    }

    const isolated = mode === "isolated" || mode === "enterprise";

    return { mode, isolated, violations };
  }

  protectedResources(): string[] {
    return [...PROTECTED];
  }
}

export const tenancyEngine = new TenancyEngine();
