import { describe, it, expect, vi } from "vitest";
import { teamPolicy } from "../../../bhudhi/teams/policy/TeamPolicy.js";
import { teamIdentity } from "../../../bhudhi/teams/team-identity/TeamIdentity.js";
import { collaborationEngine } from "../../../bhudhi/teams/collaboration/CollaborationEngine.js";
import { coordinationEngine } from "../../../bhudhi/teams/coordination/CoordinationEngine.js";
import { consensusEngine } from "../../../bhudhi/teams/consensus/ConsensusEngine.js";
import { humanAgentCollaboration } from "../../../bhudhi/teams/human-agent/HumanAgentCollaboration.js";
import { teamExecution } from "../../../bhudhi/teams/execution/TeamExecution.js";
import { alignmentEngine } from "../../../bhudhi/teams/alignment/AlignmentEngine.js";
import { teamHealth } from "../../../bhudhi/teams/health/TeamHealth.js";
import { teamMemory } from "../../../bhudhi/teams/team-memory/TeamMemory.js";

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
    bhudhiTeams: {},
    bhudhiTeamIdentity: {},
    bhudhiTeamMemory: {},
    bhudhiTeamAlignment: {},
    bhudhiTeamHealth: {},
  };
});

const baseInput = {
  blueprintId: "00000000-0000-4000-8000-00000000000b",
  name: "Strategy Team",
  members: [
    { userId: "u1", role: "OWNER" },
    { userId: "agent-1", role: "ASSISTANT", isAgent: true },
  ],
  projects: [{ id: "p1", name: "Launch", status: "active" }],
  organization: { alignment: 0.75, vision: "Execute blueprint" },
};

describe("BTIE — TeamPolicy", () => {
  it("rejects force consensus and hide conflict", () => {
    const r = teamPolicy.validate({ ...baseInput, constraints: ["HIDE_CONFLICT"] });
    expect(r.allowed).toBe(false);
  });
});

describe("BTIE — TeamIdentity", () => {
  it("tracks mission values strengths blindspots", () => {
    const ti = teamIdentity.build(baseInput);
    expect(ti.identity.mission).toBeTruthy();
    expect(ti.health).toBeGreaterThan(0);
  });
});

describe("BTIE — CollaborationEngine", () => {
  it("reduces coordination cost with actions", () => {
    const c = collaborationEngine.analyze(baseInput);
    expect(c.actions.length).toBeGreaterThan(0);
  });
});

describe("BTIE — CoordinationEngine", () => {
  it("protects flow state", () => {
    const c = coordinationEngine.optimize(baseInput);
    expect(c.coordinationScore).toBeGreaterThan(0);
    expect(c.actions.length).toBeGreaterThan(0);
  });
});

describe("BTIE — ConsensusEngine", () => {
  it("makes disagreement visible with agreement score", () => {
    const c = consensusEngine.decide({ ...baseInput, consensusModel: "majority" });
    expect(c.decision).toBeTruthy();
    expect(c.agreement).toBeGreaterThan(0);
    expect(c.confidence).toBeGreaterThan(0);
  });
});

describe("BTIE — HumanAgentCollaboration", () => {
  it("keeps humans accountable", () => {
    const ha = humanAgentCollaboration.evaluate({
      ...baseInput,
      execution: { reviewRequired: true },
    });
    expect(ha.approvalRequired).toBe(true);
    expect(["human-led", "agent-assisted", "agent-operated", "review-required"]).toContain(ha.mode);
  });
});

describe("BTIE — TeamExecution", () => {
  it("tracks velocity blockers completion", () => {
    const e = teamExecution.manage(baseInput);
    expect(e.velocity).toBeGreaterThanOrEqual(0);
  });
});

describe("BTIE — AlignmentEngine", () => {
  it("alignment beats speed messaging", () => {
    const a = alignmentEngine.track(baseInput, 0.8);
    expect(a.alignment).toBeGreaterThan(0);
    expect(a.recommendations.length).toBeGreaterThan(0);
  });
});

describe("BTIE — TeamHealth", () => {
  it("scores 0-100 with actions", () => {
    const h = teamHealth.measure(baseInput, 0.2);
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.score).toBeLessThanOrEqual(100);
    expect(["recover", "adapt", "escalate", "none"]).toContain(h.action);
  });
});

describe("BTIE — TeamEngine", () => {
  it("create answers who owns and who decides", async () => {
    const { teamEngine } = await import("../../../bhudhi/teams/team-engine/TeamEngine.js");
    const out = await teamEngine.create(baseInput);
    expect(out.teamState.memberCount).toBe(2);
    expect(out.recommendation).toBeTruthy();
    expect(out.consensus).toBeTruthy();
  });

  it("validateBeforeDecision blocks low alignment", async () => {
    const { teamEngine } = await import("../../../bhudhi/teams/team-engine/TeamEngine.js");
    const gate = await teamEngine.validateBeforeDecision({
      ...baseInput,
      organization: { alignment: 0.1 },
      execution: { dissent: true, blocked: true },
      members: [],
    });
    expect(gate.allowed).toBe(false);
  });

  it("stores team memory", async () => {
    const { teamEngine } = await import("../../../bhudhi/teams/team-engine/TeamEngine.js");
    const out = await teamEngine.create(baseInput);
    teamMemory.store(out.teamId, out);
    expect(teamMemory.get(out.teamId)?.sessionId).toBe(out.sessionId);
  });
});
