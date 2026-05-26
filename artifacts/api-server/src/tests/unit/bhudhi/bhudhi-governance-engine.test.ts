import { describe, it, expect, vi, beforeEach } from "vitest";
import { isForbiddenAction, IMMUTABLE_SYSTEM_LAWS } from "../../../bhudhi/governance/contracts/immutableRules.js";
import { policyEngine } from "../../../bhudhi/governance/policy-engine/PolicyEngine.js";
import { capabilityRegistry } from "../../../bhudhi/governance/capability-engine/CapabilityRegistry.js";
import { riskGovernor } from "../../../bhudhi/governance/risk/RiskGovernor.js";
import { governanceEnforcer } from "../../../bhudhi/governance/enforcement/GovernanceEnforcer.js";
import { governanceAudit } from "../../../bhudhi/governance/audit/GovernanceAudit.js";

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

  const chain = () => ({
    from: vi.fn(() => ({
      where: vi.fn(() => emptyQueryResult()),
      orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
    })),
  });
  return {
    db: {
      select: vi.fn(() => chain()),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "audit-1" }]),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "x" }]) })),
        })),
      })),
    },
    bhudhiGovernanceAudit: {},
    bhudhiGovernanceApprovals: {},
    bhudhiGovernanceViolations: {},
    bhudhiGovernanceEmergency: {},
    bhudhiGovernanceMemory: {},
  };
});

describe("BHUDHI Governance Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defines immutable system laws", () => {
    expect(IMMUTABLE_SYSTEM_LAWS.length).toBeGreaterThanOrEqual(8);
    expect(isForbiddenAction("MODIFY_SIGNALS")).toBe(true);
    expect(isForbiddenAction("DELETE_AUDIT")).toBe(true);
    expect(isForbiddenAction("EXECUTE_WORKFLOW")).toBe(false);
  });

  it("PolicyEngine blocks forbidden actions", () => {
    const result = policyEngine.evaluatePolicy(
      { type: "bhudhi", id: "bhudhi-core" },
      "MODIFY_SIGNALS",
      {},
    );
    expect(result.allowed).toBe(false);
    expect(result.requiredApprovals).toContain("L5");
  });

  it("PolicyEngine blocks Bhudhi self-approve", () => {
    const result = policyEngine.evaluatePolicy(
      { type: "bhudhi", id: "bhudhi" },
      "SELF_APPROVE",
      {},
    );
    expect(result.allowed).toBe(false);
  });

  it("CapabilityRegistry marks DeploySystem as CRITICAL", () => {
    const cap = capabilityRegistry.get("DEPLOY_SYSTEM");
    expect(cap?.risk).toBe("CRITICAL");
    expect(cap?.requiresApproval).toBe("L4");
  });

  it("RiskGovernor escalates danger signal on execute", () => {
    const risk = riskGovernor.assess("EXECUTE_WORKFLOW", {
      globalSignal: "danger",
      confidence: 0.3,
    });
    expect(risk.riskType).toMatch(/HIGH|CRITICAL|LOCK/);
    expect(risk.requiresApproval).toBe(true);
  });

  it("GovernanceEnforcer rejects when policy fails", () => {
    const policy = policyEngine.evaluatePolicy(
      { type: "bhudhi", id: "x" },
      "REWRITE_BLUEPRINT",
      {},
    );
    const risk = riskGovernor.assess("REWRITE_BLUEPRINT", {});
    const action = governanceEnforcer.decide(policy, risk, "REWRITE_BLUEPRINT");
    expect(action).toBe("REJECT");
  });

  it("GovernanceAudit cannot delete records", async () => {
    await expect(governanceAudit.delete()).rejects.toThrow(/immutable/i);
  });
});

describe("BHUDHI Governance Engine — integration", () => {
  it("GovernanceEngine.check allows low-risk user actions", async () => {
    const { governanceEngine } = await import("../../../bhudhi/governance/GovernanceEngine.js");
    const result = await governanceEngine.check(
      { type: "user", id: "user-1" },
      "READ_MEMORY",
      { blueprintId: "bp-1" },
    );
    expect(result.policy.allowed).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("GovernanceEngine requires approval record for system execute", async () => {
    const { governanceEngine } = await import("../../../bhudhi/governance/GovernanceEngine.js");
    const result = await governanceEngine.check(
      { type: "system", id: "bhudhi-operating" },
      "EXECUTE_WORKFLOW",
      { blueprintId: "bp-1", recommendationId: "rec-1", confidence: 0.85 },
    );
    expect(result.policy.allowed).toBe(true);
    expect(result.pendingApprovalIds.length).toBeGreaterThan(0);
  });
});
