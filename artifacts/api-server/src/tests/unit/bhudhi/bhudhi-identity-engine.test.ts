import { describe, it, expect, vi, beforeEach } from "vitest";
import { identityGraph } from "../../../bhudhi/identity/profile/IdentityGraph.js";
import { valueEngine } from "../../../bhudhi/identity/values/ValueEngine.js";
import { motivationEngine } from "../../../bhudhi/identity/motivation/MotivationEngine.js";
import { capabilityEngine } from "../../../bhudhi/identity/capability/CapabilityEngine.js";
import { personalityEngine } from "../../../bhudhi/identity/personality/PersonalityEngine.js";
import { growthEngine } from "../../../bhudhi/identity/growth/GrowthEngine.js";
import { identityAdaptation } from "../../../bhudhi/identity/adaptation/IdentityAdaptation.js";
import { identityDrift } from "../../../bhudhi/identity/drift/IdentityDrift.js";
import { identityPolicy } from "../../../bhudhi/identity/policy/IdentityPolicy.js";

vi.mock("@workspace/db", () => {
  function emptyQueryResult(): Promise<unknown[]> & {
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } {
    const promise = Promise.resolve([]) as Promise<unknown[]> & {
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };
    promise.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) }));
    promise.limit = vi.fn().mockResolvedValue([]);
    return promise;
  }

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => emptyQueryResult()),
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
      })),
    },
    bhudhiIdentityProfiles: {},
    bhudhiIdentityValues: {},
    bhudhiIdentityGrowth: {},
    bhudhiIdentityHistory: {},
    bhudhiIdentityEvents: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000003",
  userId: "00000000-0000-4000-8000-000000000099",
  trigger: "TASK_FEEDBACK",
  memory: "Completed weekly milestone",
  signals: { global: "power", confidence: 0.85, momentum: 0.7 },
  life: { energyLevel: 0.6, meaningAlignment: 0.75 },
  feedback: { learning: true },
};

describe("BIIE — IdentityGraph", () => {
  it("builds connected identity nodes", () => {
    const { nodes, edges } = identityGraph.build(baseInput);
    expect(nodes.length).toBeGreaterThanOrEqual(5);
    expect(edges.length).toBeGreaterThan(0);
  });
});

describe("BIIE — ValueEngine", () => {
  it("ranks values and protects health/family", () => {
    const values = valueEngine.assess(baseInput);
    expect(values.rankedValues.length).toBeGreaterThanOrEqual(5);
    expect(values.protectionRules.some((r) => r.includes("health"))).toBe(true);
  });

  it("blocks actions that harm protected values", () => {
    const values = valueEngine.assess(baseInput);
    expect(valueEngine.wouldViolateProtected("sacrifice health for speed", values)).toBe(true);
  });
});

describe("BIIE — MotivationEngine", () => {
  it("detects motivation type and recommendations", () => {
    const m = motivationEngine.detect({ ...baseInput, feedback: { curiosity: true } });
    expect(m.motivationType).toBe("curiosity");
    expect(m.recommendations.length).toBeGreaterThan(0);
  });
});

describe("BIIE — CapabilityEngine", () => {
  it("scores dimensions with velocity", () => {
    const c = capabilityEngine.score({
      ...baseInput,
      execution: { status: "completed" },
      history: { streak: 5 },
    });
    expect(c.capabilityScore).toBeGreaterThan(0.5);
    expect(c.dimensions.execution.current).toBeGreaterThan(0.5);
  });
});

describe("BIIE — PersonalityEngine", () => {
  it("profiles behavior without stereotyping labels only", () => {
    const dims = personalityEngine.dimensions(baseInput);
    const profile = personalityEngine.executionProfile(dims);
    expect(["Explorer", "Builder", "Strategist", "Operator", "Creator"]).toContain(profile);
  });
});

describe("BIIE — GrowthEngine", () => {
  it("tracks trajectory and transitions", () => {
    const g = growthEngine.assess(baseInput, 0.55, 0.7);
    expect(g.currentState).toBeTruthy();
    expect(g.recommendedTransitions.length).toBeGreaterThan(0);
  });
});

describe("BIIE — IdentityAdaptation", () => {
  it("adapts communication and tasks but not governance", () => {
    const dims = personalityEngine.dimensions(baseInput);
    const m = motivationEngine.detect(baseInput);
    const profile = personalityEngine.executionProfile(dims);
    const adapt = identityAdaptation.adapt(baseInput, profile, m, dims);
    expect(adapt.communication).toBeTruthy();
    expect(adapt.tasks).toBeTruthy();
  });
});

describe("BIIE — IdentityDrift", () => {
  it("detects burnout and escalates", () => {
    const values = valueEngine.assess(baseInput);
    const drift = identityDrift.detect({ ...baseInput, feedback: { burnout: true } }, values);
    expect(drift.detected).toBe(true);
    expect(drift.signals).toContain("burnout");
    expect(drift.action).toBe("pause");
  });
});

describe("BIIE — IdentityPolicy", () => {
  it("forbids manipulation and governance override", () => {
    const result = identityPolicy.validate({
      blueprintId: baseInput.blueprintId,
      life: { manipulateUser: true },
      constraints: ["BYPASS_GOVERNANCE"],
    });
    expect(result.allowed).toBe(false);
  });
});

describe("BIIE — IdentityEngine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("process returns full identity output", async () => {
    const { identityEngine } = await import("../../../bhudhi/identity/identity-engine/IdentityEngine.js");
    const output = await identityEngine.process(baseInput);

    expect(output.sessionId).toBeTruthy();
    expect(output.identityState.executionProfile).toBeTruthy();
    expect(output.values.rankedValues.length).toBeGreaterThan(0);
    expect(output.capabilities.capabilityScore).toBeGreaterThan(0);
    expect(output.growthDirection.nextIdentity).toBeTruthy();
    expect(output.graph.nodes.length).toBeGreaterThan(0);
  });

  it("formatIdentityContext answers who and what matters", async () => {
    const { identityEngine } = await import("../../../bhudhi/identity/identity-engine/IdentityEngine.js");
    const output = await identityEngine.process(baseInput);
    const ctx = identityEngine.formatIdentityContext(output);
    expect(ctx).toContain("Values:");
    expect(ctx).toContain("Motivation:");
  });

  it("validateExecutionAgainstValues blocks protected value harm", async () => {
    const { identityEngine } = await import("../../../bhudhi/identity/identity-engine/IdentityEngine.js");
    const output = await identityEngine.process(baseInput);
    const check = identityEngine.validateExecutionAgainstValues("sacrifice health", output);
    expect(check.allowed).toBe(false);
  });
});
