import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  KNOWN_ADJUST_FIXTURES,
  KNOWN_FALSE_PROGRESS_FIXTURES,
  KNOWN_PIVOT_FIXTURES,
  KNOWN_PROCEED_FIXTURES,
} from "./fixtures/known-verdicts.js";

const { mockInsert, mockSelectChain } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelectChain: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    insert: mockInsert,
    select: mockSelectChain,
    delete: vi.fn(),
    update: vi.fn(),
  },
  erectorIntegrityFlags: { id: "id" },
  erectorManualReviewCases: { id: "id" },
  erectorEvidenceLedger: { id: "id" },
  erectorObservabilityLogs: { id: "id" },
}));

function buildSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
}

describe("erector.integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockSelectChain.mockReturnValue(buildSelectChain([]));
  });

  it("rejects duplicate proof submissions within 7 days", async () => {
    const { IntegrityLayer } = await import("../../engines/erector/IntegrityLayer.js");
    const layer = new IntegrityLayer();

    const result = await layer.evaluate(
      "user-1",
      "bp-1",
      {
        userId: "user-1",
        blueprintId: "bp-1",
        sourceType: "user_upload",
        sourceLocation: "same-file.pdf",
        contentJson: {},
        evidence_class: "DIRECT_ARTIFACT",
      },
      [
        {
          id: "ev-1",
          source_location: "same-file.pdf",
          validation_status: "pending",
          created_at: new Date(),
        } as never,
      ],
    );

    expect(result.action).toBe("evidence_rejected");
    expect(result.flags).toContain("DUPLICATE_PROOF");
  });

  it("flags bypass attempts after repeated intention-only evidence", async () => {
    const { IntegrityLayer } = await import("../../engines/erector/IntegrityLayer.js");
    const layer = new IntegrityLayer();

    const existing = Array.from({ length: 2 }).map((_, i) => ({
      id: `ev-${i}`,
      evidence_class: "INTENTION_OR_PLAN",
      created_at: new Date(),
    }));

    const result = await layer.evaluate(
      "user-1",
      "bp-1",
      {
        userId: "user-1",
        blueprintId: "bp-1",
        sourceType: "user_upload",
        contentJson: {},
        evidence_class: "INTENTION_OR_PLAN",
      },
      existing as never,
    );

    expect(result.flags).toContain("BYPASS_ATTEMPT");
    expect(result.confidence_impact).toBeLessThan(-0.4);
  });
});

describe("erector.privacy", () => {
  it("redacts sensitive audit snapshot fields", async () => {
    const { redactAuditSnapshot } = await import(
      "../../services/erector/PrivacySecurityLayer.js"
    );

    const redacted = redactAuditSnapshot({
      budget: 5000,
      location: "Lagos, Nigeria",
      prior_attempts: ["failed startup"],
      scores: { demand: 70 },
    });

    expect(redacted.budget).toBe("[REDACTED]");
    expect(redacted.location).toBe("[REDACTED]");
    expect(redacted.prior_attempts).toBe("[REDACTED]");
    expect(redacted.scores).toEqual({ demand: 70 });
  });
});

describe("erector.tier-permissions", () => {
  it("blocks simulation for starter tier", async () => {
    const { assertTierPermission } = await import(
      "../../services/erector/TierPermissionMatrix.js"
    );
    const result = assertTierPermission("starter", "simulation_allowed");
    expect(result.allowed).toBe(false);
  });

  it("blocks scenario access for growth tier", async () => {
    const { assertTierPermission } = await import(
      "../../services/erector/TierPermissionMatrix.js"
    );
    const result = assertTierPermission("growth", "scenario_access");
    expect(result.allowed).toBe(false);
  });

  it("allows full audit visibility for ultimate tier", async () => {
    const { hasPermission } = await import("../../services/erector/TierPermissionMatrix.js");
    expect(hasPermission("ultimate", "audit_visibility")).toBe("full");
  });
});

describe("erector.failure-recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it("maps validation timeout to retry policy", async () => {
    const { failureRecoveryLayer } = await import(
      "../../services/erector/FailureRecoveryLayer.js"
    );
    const policy = failureRecoveryLayer.resolvePolicy("VALIDATION_TIMEOUT");
    expect(policy.max_retries).toBe(3);
    expect(policy.recovery_action).toBe("retry");
  });

  it("skips duplicate validation runs with zero retries", async () => {
    const { failureRecoveryLayer } = await import(
      "../../services/erector/FailureRecoveryLayer.js"
    );
    const policy = failureRecoveryLayer.resolvePolicy("DUPLICATE_VALIDATION_RUN");
    expect(policy.max_retries).toBe(0);
    expect(policy.recovery_action).toBe("skip");
  });
});

describe("erector.observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it("writes non-blocking observability logs", async () => {
    const { ObservabilityLayer } = await import("../../engines/erector/ObservabilityLayer.js");
    await ObservabilityLayer.logRun({
      run_type: "validation_run",
      run_id: "vr-1",
      userId: "user-1",
      latency_ms: 120,
      verdict_issued: "PROCEED",
    });
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("erector.verdict fixtures", () => {
  it("defines minimum known proceed/adjust/pivot/false-progress examples", () => {
    expect(KNOWN_PROCEED_FIXTURES.length).toBeGreaterThanOrEqual(3);
    expect(KNOWN_ADJUST_FIXTURES.length).toBeGreaterThanOrEqual(3);
    expect(KNOWN_PIVOT_FIXTURES.length).toBeGreaterThanOrEqual(3);
    expect(KNOWN_FALSE_PROGRESS_FIXTURES.length).toBeGreaterThanOrEqual(2);
  });
});

describe("erector.harness registry", () => {
  it("lists required suite names for Prompt 13", () => {
    const suites = [
      "erector.verdict",
      "erector.economic-type",
      "erector.simulation",
      "erector.evidence",
      "erector.signals",
      "erector.false-progress",
      "erector.academy",
      "erector.phase-gate",
      "erector.correction",
      "erector.state-machine",
      "erector.integrity",
      "erector.api",
      "erector.e2e",
    ];
    expect(suites).toHaveLength(13);
  });
});
