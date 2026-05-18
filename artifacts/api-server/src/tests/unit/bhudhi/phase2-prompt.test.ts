/**
 * BHUDHI_CURSOR_PROMPT_2 — Blueprint infrastructure tests
 */
import { describe, it, expect, vi } from "vitest";
import { validateOutputLayers } from "../../../bhudhi/OutputValidatorLayers.js";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import { validateDependencyChain } from "../../../engines/blueprint/BlueprintStructureService.js";
import { checkContradictionBlock } from "../../../engines/blueprint/BlueprintGovernanceEngine.js";
import * as ContradictionEngine from "../../../engines/contradiction/ContradictionEngine.js";
import { AGENT_REGISTRY } from "../../../bhudhi/AgentRegistry.js";

const integration = process.env.TORGIMA_INTEGRATION === "true";

describe("Prompt 2 — Prompt contracts", () => {
  it("registers blueprint.health_analysis.v1 and blueprint.interpret.v1", () => {
    expect(getContract("BLUEPRINT_GENERATION")?.name).toBe("blueprint.health_analysis.v1");
    expect(getContract("BLUEPRINT_INTERPRETATION")?.name).toBe("blueprint.interpret.v1");
  });

  it("BLUEPRINT agent is ACTIVE in registry", () => {
    expect(AGENT_REGISTRY.BLUEPRINT.status).toBe("ACTIVE");
  });
});

describe("Prompt 2 — Three Laws (unit)", () => {
  it("TEST 1: interpretation output cannot claim approve/override", async () => {
    const result = await validateOutputLayers({
      raw: {
        outputType: "blueprint_interpretation",
        contractVersion: "1.0",
        stateVersion: 1,
        confidence: "HIGH",
        forbiddenActionRequested: false,
        missingFields: [],
        warnings: [],
        data: {
          interpretation: "I have approved your blueprint and marked phase complete",
          keyInsights: ["x"],
          currentFocus: "y",
          nextMilestone: "z",
          riskFlags: [],
        },
      },
      expectedType: "blueprint_interpretation",
      expectedStateVersion: 1,
      userId: "00000000-0000-0000-0000-000000000010",
      promptContract: "blueprint.interpret.v1",
    });
    expect(result.passed).toBe(false);
  });

  it("TEST 2: stale worldStateVersion rejected in layers", async () => {
    const result = await validateOutputLayers({
      raw: {
        outputType: "blueprint_health",
        contractVersion: "1.0",
        stateVersion: 99,
        confidence: "MEDIUM",
        forbiddenActionRequested: false,
        missingFields: [],
        warnings: [],
        data: {
          healthScore: 0.5,
          gapsDetected: [],
          proposalsGenerated: [],
          agentAssessment: "ok",
          confidenceTier: "MEDIUM",
        },
      },
      expectedType: "blueprint_health",
      expectedStateVersion: 99,
      userId: "00000000-0000-0000-0000-000000000099",
      promptContract: "blueprint.health_analysis.v1",
    });
    expect(result.passed).toBe(false);
    expect(result.failLayer).toBe("world_state_version");
  });

  it("TEST 8: contradiction block when HARD contradiction pending", async () => {
    const spy = vi.spyOn(ContradictionEngine, "hasHardContradiction").mockResolvedValue(true);
    const block = await checkContradictionBlock("00000000-0000-0000-0000-000000000001");
    expect(block.blocked).toBe(true);
    expect(block.reason).toMatch(/HARD contradiction/i);
    spy.mockRestore();
  });
});

describe.runIf(integration)("Prompt 2 — Integration", () => {
  it("TEST 3-6: governance proposal approve/reject/stale", async () => {
    const { submitProposal, approveProposal, rejectProposal } = await import(
      "../../../engines/governance/GovernanceService.js"
    );
    const { db, governanceQueue, blueprints } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const userId = process.env.TORGIMA_TEST_USER_ID!;
    const blueprintId = process.env.TORGIMA_TEST_BLUEPRINT_ID!;

    const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    const version = bp?.state_version ?? 0;

    const row = await submitProposal({
      proposal: {
        proposalType: "RESEQUENCE",
        proposalContent: { entityType: "phase", sequenceOrder: 1 },
        rationale: "Test proposal",
        evidenceCitations: ["unit test"],
        impactAssessment: { low: true },
        priority: "NORMAL",
      },
      blueprintId,
      userId,
      worldStateVersion: version,
    });

    const pending = await db
      .select()
      .from(governanceQueue)
      .where(eq(governanceQueue.id, row.id));
    expect(pending[0]?.status).toBe("PENDING");

    await rejectProposal(row.id, userId, "test reject");
    const rejected = await db.select().from(governanceQueue).where(eq(governanceQueue.id, row.id));
    expect(rejected[0]?.status).toBe("REJECTED");

    const row2 = await submitProposal({
      proposal: {
        proposalType: "RESEQUENCE",
        proposalContent: { entityType: "phase", sequenceOrder: 2 },
        rationale: "Approve me",
        evidenceCitations: ["unit"],
        impactAssessment: {},
        priority: "HIGH",
      },
      blueprintId,
      userId,
      worldStateVersion: version,
    });

    await db.update(blueprints).set({ state_version: version + 1 }).where(eq(blueprints.id, blueprintId));

    await expect(approveProposal(row2.id, userId)).rejects.toMatchObject({ code: "STALE_STATE" });
  });

  it("TEST 10: validateDependencyChain detects orphan project", async () => {
    const blueprintId = process.env.TORGIMA_TEST_BLUEPRINT_ID!;
    const { db, projects } = await import("@workspace/db");
    const { eq: eqOp } = await import("drizzle-orm");
    const [orphan] = await db
      .insert(projects)
      .values({
        blueprint_id: blueprintId,
        phase_id: null,
        name: "Orphan test project",
        type: "execution",
        status: "pending",
      })
      .returning({ id: projects.id });

    const result = await validateDependencyChain(blueprintId);
    expect(result.violations.some(v => v.includes("Orphaned Project"))).toBe(true);

    if (orphan?.id) {
      await db.delete(projects).where(eqOp(projects.id, orphan.id));
    }
  });
});
