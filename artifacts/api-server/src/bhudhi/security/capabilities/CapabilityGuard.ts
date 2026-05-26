import type { CapabilityDeclaration, CapabilityLevel, SecurityInput } from "../contracts/types.js";

export class CapabilityGuard {
  validate(input: SecurityInput): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const caps = input.capabilities ?? [];

    if (caps.length === 0) {
      violations.push("No capabilities declared — default PUBLIC only");
      return { valid: true, violations };
    }

    for (const c of caps) {
      if (!c.capability || !c.level) {
        violations.push("Capability must declare capability, level, scope");
      }
      if (c.expiration && new Date(c.expiration) < new Date()) {
        violations.push(`Expired capability: ${c.capability}`);
      }
      if (c.level === "IMMUTABLE" && input.execution?.mutate === true) {
        violations.push(`IMMUTABLE capability ${c.capability} cannot mutate`);
      }
    }

    const hidden = input.execution?.hiddenCapability === true;
    if (hidden) {
      violations.push("No hidden capabilities allowed");
    }

    return { valid: violations.length === 0 || violations.every((v) => v.includes("default")), violations };
  }

  maxLevel(caps: CapabilityDeclaration[]): CapabilityLevel {
    const order: CapabilityLevel[] = ["PUBLIC", "LIMITED", "PRIVILEGED", "CRITICAL", "IMMUTABLE"];
    let max: CapabilityLevel = "PUBLIC";
    for (const c of caps) {
      if (order.indexOf(c.level) > order.indexOf(max)) max = c.level;
    }
    return max;
  }
}

export const capabilityGuard = new CapabilityGuard();
