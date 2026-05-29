import { describe, it, expect } from "vitest";
import { getBaseRules } from "../../../engines/control/ControlEngine.js";

describe("ControlEngine — base rules", () => {
  it("danger has taskMax = 3", () => {
    const rules = getBaseRules("danger");
    expect(rules.taskMax).toBe(3);
  });
  it("danger blocks scaling_operations", () => {
    const rules = getBaseRules("danger");
    expect(rules.blockedActions).toContain("scaling_operations");
  });
  it("affluence allows all actions", () => {
    const rules = getBaseRules("affluence");
    expect(rules.blockedActions).toHaveLength(0);
  });
  it("power has phase_permission = accelerated", () => {
    const rules = getBaseRules("power");
    expect(rules.phasePermission).toBe("accelerated");
  });
  it("danger requires recovery", () => {
    const rules = getBaseRules("danger");
    expect(rules.recoveryRequired).toBe(true);
  });
  it("stability does not require recovery", () => {
    const rules = getBaseRules("stability");
    expect(rules.recoveryRequired).toBe(false);
  });
  it("all 7 conditions have rules defined", () => {
    const conditions = [
      "nothingness",
      "danger",
      "urgency",
      "stability",
      "power",
      "affluence",
      "power_change",
    ];
    conditions.forEach((c) => {
      const rules = getBaseRules(c);
      expect(rules).toBeDefined();
      expect(rules.taskMin).toBeGreaterThan(0);
      expect(rules.taskMax).toBeGreaterThanOrEqual(rules.taskMin);
    });
  });
});
