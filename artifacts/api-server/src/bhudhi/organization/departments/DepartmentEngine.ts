import type { Department, DepartmentHealth, OrgInput } from "../contracts/types.js";

const DEPARTMENTS: Department[] = [
  "strategy",
  "product",
  "engineering",
  "operations",
  "research",
  "marketing",
  "finance",
];

export class DepartmentEngine {
  assess(input: OrgInput): DepartmentHealth[] {
    const active = new Set((input.users ?? []).map((u) => u.department).filter(Boolean));
    return DEPARTMENTS.map((dept) => {
      const engaged = active.has(dept);
      const projectCount = (input.projects ?? []).filter(
        (p) => (p as { department?: string }).department === dept,
      ).length;
      const velocity = engaged ? 0.6 + projectCount * 0.05 : 0.3;
      const alignment = input.strategy?.priorities ? 0.7 : engaged ? 0.55 : 0.35;
      const efficiency = (velocity + alignment) / 2;
      const risk = input.signals?.global === "danger" && dept === "operations" ? 0.75 : 0.25;
      return {
        department: dept,
        health: Math.min(1, efficiency * (1 - risk * 0.3)),
        risk,
        efficiency,
      };
    });
  }
}

export const departmentEngine = new DepartmentEngine();
