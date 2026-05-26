import { describe, it, expect, vi } from "vitest";
import { securityPolicy } from "../../../bhudhi/security/policy/SecurityPolicy.js";
import { trustEngine } from "../../../bhudhi/security/trust/TrustEngine.js";
import { authorizationEngine } from "../../../bhudhi/security/authorization/AuthorizationEngine.js";
import { capabilityGuard } from "../../../bhudhi/security/capabilities/CapabilityGuard.js";
import { sandboxEngine } from "../../../bhudhi/security/sandbox/SandboxEngine.js";
import { secretEngine } from "../../../bhudhi/security/secrets/SecretEngine.js";
import { threatEngine } from "../../../bhudhi/security/monitoring/ThreatEngine.js";
import { securityResponse } from "../../../bhudhi/security/response/SecurityResponse.js";
import { securityMemory } from "../../../bhudhi/security/security-memory/SecurityMemory.js";

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
    },
    bhudhiSecurityEvents: {},
    bhudhiTrustProfiles: {},
    bhudhiThreatRecords: {},
    bhudhiPermissionHistory: {},
    bhudhiSecretRegistry: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-000000000009",
  actorId: "user-1",
  identity: { verified: true, userId: "user-1", role: "OWNER" },
  governance: { approved: true },
  capabilities: [{ capability: "execution.run", level: "PRIVILEGED" as const, scope: "bp" }],
};

describe("BSE — SecurityPolicy", () => {
  it("rejects forbidden actions", () => {
    const r = securityPolicy.validate({ ...baseInput, constraints: ["SELF_ESCALATE"] });
    expect(r.allowed).toBe(false);
  });
});

describe("BSE — TrustEngine", () => {
  it("scores trust with decay levels", () => {
    const t = trustEngine.score(baseInput);
    expect(["UNTRUSTED", "LIMITED", "TRUSTED", "ELEVATED", "SEALED"]).toContain(t.trustLevel);
    expect(t.trustScore).toBeGreaterThanOrEqual(0);
    expect(t.expiration).toBeTruthy();
  });
});

describe("BSE — AuthorizationEngine", () => {
  it("default denies untrusted", () => {
    const auth = authorizationEngine.authorize(baseInput, "UNTRUSTED", "execute");
    expect(auth.allowed).toBe(false);
  });

  it("allows execute for trusted with capability", () => {
    const auth = authorizationEngine.authorize(baseInput, "TRUSTED", "execute");
    expect(auth.allowed).toBe(true);
  });
});

describe("BSE — CapabilityGuard", () => {
  it("rejects hidden capabilities", () => {
    const v = capabilityGuard.validate({
      ...baseInput,
      execution: { hiddenCapability: true },
      capabilities: [{ capability: "x", level: "PUBLIC", scope: "a" }],
    });
    expect(v.valid).toBe(false);
  });
});

describe("BSE — SandboxEngine", () => {
  it("requires sandbox for unknown execution", () => {
    const s = sandboxEngine.evaluate({
      ...baseInput,
      execution: { unknownOrigin: true },
    });
    expect(s.required).toBe(true);
    expect(s.mode).toBe("STRICT");
  });
});

describe("BSE — SecretEngine", () => {
  it("uses vault refs not plaintext", () => {
    const ref = secretEngine.register(baseInput.blueprintId, "api_key", "token");
    expect(ref.vaultRef.startsWith("vault://")).toBe(true);
    expect(secretEngine.canAccess(true)).toBe(false);
  });
});

describe("BSE — ThreatEngine", () => {
  it("detects privilege escalation and lockdown", () => {
    const threats = threatEngine.detect({
      ...baseInput,
      execution: { privilegeEscalation: true, exfiltration: true },
    });
    expect(threats.some((t) => t.severity === "CRITICAL" || t.severity === "LOCKDOWN")).toBe(true);
  });
});

describe("BSE — SecurityResponse", () => {
  it("responds with freeze on lockdown", () => {
    const threats = threatEngine.detect({
      ...baseInput,
      execution: { exfiltration: true },
    });
    const r = securityResponse.respond(threats);
    expect(r.action).toBe("freeze");
  });
});

describe("BSE — SecurityEngine", () => {
  it("verify answers who initiated and can they", async () => {
    const { securityEngine } = await import(
      "../../../bhudhi/security/security-engine/SecurityEngine.js"
    );
    const out = await securityEngine.verify(baseInput);
    expect(out.trustScore).toBeGreaterThan(0);
    expect(["allow", "deny", "escalate", "sandbox"]).toContain(out.decision);
  });

  it("validateBeforeExecution blocks critical threats", async () => {
    const { securityEngine } = await import(
      "../../../bhudhi/security/security-engine/SecurityEngine.js"
    );
    const gate = await securityEngine.validateBeforeExecution({
      ...baseInput,
      execution: { exfiltration: true },
    });
    expect(gate.allowed).toBe(false);
  });

  it("stores security memory", async () => {
    const { securityEngine } = await import(
      "../../../bhudhi/security/security-engine/SecurityEngine.js"
    );
    const out = await securityEngine.verify(baseInput);
    securityMemory.store(baseInput.blueprintId, out);
    expect(securityMemory.get(baseInput.blueprintId)?.sessionId).toBe(out.sessionId);
  });
});
