import { describe, it, expect, vi, beforeEach } from "vitest";
import { beliefRegistry } from "../../../bhudhi/beliefs/belief-registry/BeliefRegistry.js";
import { evidenceEngine } from "../../../bhudhi/beliefs/evidence-engine/EvidenceEngine.js";
import { truthEngine } from "../../../bhudhi/beliefs/truth-engine/TruthEngine.js";
import { hypothesisEngine } from "../../../bhudhi/beliefs/hypothesis-engine/HypothesisEngine.js";
import { contradictionEngine } from "../../../bhudhi/beliefs/contradiction-engine/ContradictionEngine.js";
import { uncertaintyEngine } from "../../../bhudhi/beliefs/uncertainty/UncertaintyEngine.js";
import { beliefConfidence } from "../../../bhudhi/beliefs/confidence/BeliefConfidence.js";
import { beliefPolicy } from "../../../bhudhi/beliefs/policy/BeliefPolicy.js";
import { beliefEvolution } from "../../../bhudhi/beliefs/evolution/BeliefEvolution.js";
import { beliefDrift } from "../../../bhudhi/beliefs/drift/BeliefDrift.js";

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
          where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "b1" }]) })),
        })),
      })),
    },
    bhudhiBeliefRecords: {},
    bhudhiBeliefEvidence: {},
    bhudhiBeliefHistory: {},
    bhudhiBeliefTruth: {},
    bhudhiBeliefConflicts: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000001",
  trigger: "TASK_FEEDBACK",
  memory: "User completed order with high satisfaction",
  signals: { global: "power", confidence: 0.82 },
};

describe("BBAE — BeliefRegistry", () => {
  it("classifies facts, beliefs, assumptions from input", () => {
    const records = beliefRegistry.classifyFromInput(baseInput);
    expect(records.length).toBeGreaterThan(0);
    const types = new Set(records.map((r) => r.type));
    expect(types.has("fact") || types.has("belief")).toBe(true);
  });

  it("nothing becomes fact without evidence enforcement", () => {
    const fact = beliefRegistry.create({
      type: "fact",
      statement: "Unverified claim",
      origin: "test",
      state: "OBSERVED",
      confidence: 0.9,
    });
    const enforced = evidenceEngine.enforceFactEvidence([fact]);
    expect(enforced[0]!.type).toBe("assumption");
  });
});

describe("BBAE — EvidenceEngine", () => {
  it("scores reliability, recency, agreement, repeatability", () => {
    const ev = evidenceEngine.score("execution", { reliability: 0.9 });
    expect(ev.evidenceScore).toBeGreaterThan(0.5);
    expect(["weak", "moderate", "strong"]).toContain(ev.strength);
  });
});

describe("BBAE — TruthEngine", () => {
  it("truth expires by category", () => {
    const record = beliefRegistry.create({
      type: "fact",
      statement: "Signal stable",
      origin: "signals",
      evidence: [evidenceEngine.score("life")],
    });
    const truth = truthEngine.assess(record);
    expect(truth.expiresAt).toBeDefined();
    expect(truth.truthScore).toBeGreaterThan(0);
  });
});

describe("BBAE — HypothesisEngine", () => {
  it("generates hypotheses with test plans", () => {
    const base = beliefRegistry.classifyFromInput(baseInput);
    const hypos = hypothesisEngine.generate(baseInput, base);
    expect(hypos.length).toBeGreaterThanOrEqual(3);
    expect(hypos[0]!.statement).toContain("test:");
  });
});

describe("BBAE — ContradictionEngine", () => {
  it("detects conflicting facts", () => {
    const a = beliefRegistry.create({
      type: "fact",
      statement: "System is in danger state",
      origin: "signals",
    });
    const b = beliefRegistry.create({
      type: "fact",
      statement: "System is optimal and safe",
      origin: "memory",
    });
    const conflicts = contradictionEngine.detect([a, b]);
    expect(conflicts.length).toBeGreaterThan(0);
  });
});

describe("BBAE — UncertaintyEngine", () => {
  it("keeps unknown visible", () => {
    const records = beliefRegistry.classifyFromInput({ blueprintId: baseInput.blueprintId });
    const hypos = hypothesisEngine.generate(baseInput, records);
    const result = uncertaintyEngine.calculate([...records, ...hypos]);
    expect(result.unknown.length).toBeGreaterThan(0);
    expect(result.uncertainty).toBeGreaterThan(0);
  });
});

describe("BBAE — BeliefConfidence", () => {
  it("caps confidence by evidence", () => {
    const records = beliefRegistry.classifyFromInput(baseInput);
    const capped = beliefConfidence.capByEvidence(0.99, records);
    const maxEvidence = Math.max(
      ...records.flatMap((r) => r.evidence.map((e) => e.evidenceScore)),
      0.5,
    );
    expect(capped).toBeLessThanOrEqual(maxEvidence + 0.15);
    expect(capped).toBeLessThan(0.99);
  });
});

describe("BBAE — BeliefPolicy", () => {
  it("forbids invent truths and modify signals", () => {
    const result = beliefPolicy.validate({
      blueprintId: baseInput.blueprintId,
      research: { inventTruth: true },
      constraints: ["MODIFY_SIGNALS"],
    });
    expect(result.allowed).toBe(false);
    expect(result.escalateUncertainty).toBe(true);
  });
});

describe("BBAE — BeliefEvolution", () => {
  it("tracks create, challenge, validate lifecycle", () => {
    const record = beliefRegistry.create({
      type: "belief",
      statement: "Test belief",
      origin: "test",
    });
    const create = beliefEvolution.trackCreate(record);
    expect(create.changeType).toBe("create");
    const { event: challenged } = beliefEvolution.challenge(record, "New evidence");
    expect(challenged.changeType).toBe("challenge");
    const { event: validated } = beliefEvolution.validate(record);
    expect(validated.newState).toBe("VALIDATED");
  });
});

describe("BBAE — BeliefDrift", () => {
  it("detects hallucination and triggers governance", () => {
    const hallucination = beliefRegistry.create({
      type: "fact",
      statement: "Fabricated fact",
      origin: "bad",
      confidence: 0.95,
    });
    const drift = beliefDrift.detect([hallucination], []);
    expect(drift.detected).toBe(true);
    expect(drift.signals).toContain("hallucination");
    expect(drift.action).toBe("governance");
  });
});

describe("BBAE — BeliefEngine integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("process returns facts, beliefs, assumptions, hypotheses", async () => {
    const { beliefEngine } = await import("../../../bhudhi/beliefs/belief-engine/BeliefEngine.js");
    const output = await beliefEngine.process(baseInput);

    expect(output.sessionId).toBeTruthy();
    expect(output.facts.length + output.beliefs.length).toBeGreaterThan(0);
    expect(output.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.uncertainty.recommendation).toBeTruthy();
  });

  it("formatBeliefContext includes known and unknown", async () => {
    const { beliefEngine } = await import("../../../bhudhi/beliefs/belief-engine/BeliefEngine.js");
    const output = await beliefEngine.process(baseInput);
    const ctx = beliefEngine.formatBeliefContext(output);
    expect(ctx).toContain("Epistemic");
    expect(ctx).toContain("Confidence");
  });
});
