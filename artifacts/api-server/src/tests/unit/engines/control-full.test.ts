import { describe, it, expect } from "vitest";
import { getBaseRules } from "../../../engines/control/ControlEngine.js";

describe("ControlEngine — enforcement rules (Prompt 16)", () => {
  it("all 7 conditions have defined rules", () => {
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

  it("danger: low task cap, difficultyCap = very_easy", () => {
    const r = getBaseRules("danger");
    expect(r.taskMax).toBe(4);
    expect(r.difficultyCap).toBe("very_easy");
    expect(r.recoveryRequired).toBe(true);
    expect(r.scalingAllowed).toBe(false);
  });

  it("nothingness: restricted phase permission", () => {
    const r = getBaseRules("nothingness");
    expect(r.phasePermission).toBe("restricted");
    expect(r.scalingAllowed).toBe(false);
  });

  it("power: accelerated phase permission, scaling allowed", () => {
    const r = getBaseRules("power");
    expect(r.phasePermission).toBe("accelerated");
    expect(r.scalingAllowed).toBe(true);
    expect(r.blockedActions).toHaveLength(0);
  });

  it("affluence: taskMax >= 4, very_hard cap, scaling allowed", () => {
    const r = getBaseRules("affluence");
    expect(r.taskMax).toBeGreaterThanOrEqual(4);
    expect(r.difficultyCap).toBe("very_hard");
    expect(r.scalingAllowed).toBe(true);
    expect(r.blockedActions).toHaveLength(0);
  });

  it("danger blocks scaling_operations and phase_checkpoint", () => {
    const r = getBaseRules("danger");
    expect(r.blockedActions).toContain("scaling_operations");
    expect(r.blockedActions).toContain("phase_checkpoint");
  });

  it("recovery is required in danger but not stability", () => {
    expect(getBaseRules("danger").recoveryRequired).toBe(true);
    expect(getBaseRules("stability").recoveryRequired).toBe(false);
  });
});
