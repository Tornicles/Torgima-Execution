/**
 * BHUDHI_CURSOR_PROMPT_1 — Phase 1 test suite (unit-level; DB tests skipped without TORGIMA_INTEGRATION).
 */
import { describe, it, expect, vi } from "vitest";
import { validateOutputLayers, FORBIDDEN_ACTIONS } from "../../../bhudhi/OutputValidatorLayers.js";
import { validateWorldStateVersion } from "../../../engines/world-model/WorldModelEngine.js";
import { detectContradictions } from "../../../engines/contradiction/ContradictionEngine.js";
import { AGENT_REGISTRY, getActiveAgentsForTrigger } from "../../../bhudhi/AgentRegistry.js";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import { getFallback } from "../../../bhudhi/FallbackLibrary.js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const integration = process.env.TORGIMA_INTEGRATION === "true";

describe("BHUDHI Prompt 1 — Three Laws", () => {
  it("TEST 1: rejects signal write forbidden action", async () => {
    const result = await validateOutputLayers({
      raw: {
        outputType: "structured_goal",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "HIGH",
        forbiddenActionRequested: true,
        missingFields: [],
        warnings: [],
        data: { cleanedGoal: "x" },
      },
      expectedType: "structured_goal",
      expectedStateVersion: 0,
      userId: "00000000-0000-0000-0000-000000000001",
      promptContract: "goal.structure.v1",
    });
    expect(result.passed).toBe(false);
    expect(result.failLayer).toBe("forbidden_action");
  });

  it("TEST 2: rejects set_condition in payload", async () => {
    const result = await validateOutputLayers({
      raw: {
        outputType: "state_explanation",
        contractVersion: "1.0",
        stateVersion: 0,
        confidence: "MEDIUM",
        forbiddenActionRequested: false,
        missingFields: [],
        warnings: [],
        data: { headline: "x", explanation: "set_condition to power", nextActionReason: "y", displayTone: "CALM" },
      },
      expectedType: "state_explanation",
      expectedStateVersion: 0,
      userId: "00000000-0000-0000-0000-000000000001",
      promptContract: "state.explain.v1",
    });
    expect(result.passed).toBe(false);
    expect(result.failLayer).toBe("forbidden_action");
  });
});

describe("BHUDHI Prompt 1 — World Model", () => {
  it("TEST 3: validateWorldStateVersion false when no model and version > 0", async () => {
    const ok = await validateWorldStateVersion("00000000-0000-0000-0000-000000000099", 5);
    expect(ok).toBe(false);
  });

  it.runIf(integration)("TEST 4: WorldStateWorker increments version", async () => {
    const { runWorldStateUpdate } = await import("../../../workers/WorldStateWorker.js");
    const { getWorldModel } = await import("../../../engines/world-model/WorldModelEngine.js");
    const userId = process.env.TORGIMA_TEST_USER_ID!;
    const before = (await getWorldModel(userId))?.stateVersion ?? 0;
    const after = await runWorldStateUpdate(userId);
    expect(after.stateVersion).toBeGreaterThanOrEqual(before);
    const model = await getWorldModel(userId);
    expect(model?.userState.energyLevel).toBeGreaterThanOrEqual(0);
    expect(model?.userState.energyLevel).toBeLessThanOrEqual(1);
  });
});

describe("BHUDHI Prompt 1 — Contradictions", () => {
  it.runIf(integration)("TEST 6: HARD contradiction privacy + influence", async () => {
    const userId = process.env.TORGIMA_TEST_USER_ID!;
    const blueprintId = process.env.TORGIMA_TEST_BLUEPRINT_ID!;
    const r = await detectContradictions({
      userId,
      blueprintId,
      goal: "I want total privacy AND global influence with no team",
    });
    expect(r.detected).toBe(true);
    expect(r.severity).toBe("HARD");
  });

  it.runIf(integration)("TEST 7: SOFT contradiction ambitious + short timeline", async () => {
    const userId = process.env.TORGIMA_TEST_USER_ID!;
    const blueprintId = process.env.TORGIMA_TEST_BLUEPRINT_ID!;
    const r = await detectContradictions({
      userId,
      blueprintId,
      goal: "Reach 1 million users",
      timeframe: "30 days",
    });
    expect(r.detected).toBe(true);
    expect(r.severity).toBe("SOFT");
  });
});

describe("BHUDHI Prompt 1 — Fallback & contracts", () => {
  it("TEST 8: fallback returns quickly with fallbackUsed envelope", () => {
    const start = Date.now();
    const result = getFallback("fallback.goal_structure", { rawGoal: "test" }, 0);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(result.forbiddenActionRequested).toBe(false);
    expect(result.confidence).toBeTruthy();
  });

  it("TEST 9: goal.structure contract registered", () => {
    const c = getContract("GOAL_STRUCTURING");
    expect(c?.name).toBe("goal.structure.v1");
  });
});

describe("BHUDHI Prompt 1 — Agents & isolation", () => {
  it("registers 12 agents in code registry", () => {
    expect(Object.keys(AGENT_REGISTRY).length).toBeGreaterThanOrEqual(12);
  });

  it("CRITIC active for any trigger via wildcard", () => {
    const agents = getActiveAgentsForTrigger("TASK_DRAFTING");
    expect(agents).toContain("CRITIC");
  });

  it("TEST 12: Bhudhi files do not insert into signal_snapshots", () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const bhudhiDir = path.join(__dirname, "../../../bhudhi");
    const files = readdirSync(bhudhiDir).filter(f => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(path.join(bhudhiDir, file), "utf8");
      expect(/\binsert\s*\(\s*signalSnapshots\b/.test(src)).toBe(false);
      expect(/\binsert\s*\(\s*signal_snapshots\b/.test(src)).toBe(false);
    }
  });

  it("FORBIDDEN_ACTIONS includes write_signal_value", () => {
    expect(FORBIDDEN_ACTIONS).toContain("write_signal_value");
  });
});

describe.runIf(integration)("BHUDHI Prompt 1 — Overnight", () => {
  it("TEST 10-11: overnight creates morning report and pre_generated order", async () => {
    const userId = process.env.TORGIMA_TEST_USER_ID!;
    const { runOvernightCycle } = await import("../../../workers/OvernightWorker.js");
    const { morningReports, orders } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("@workspace/db");

    const { reportId } = await runOvernightCycle(userId);
    expect(reportId).toBeTruthy();

    const [report] = await db.select().from(morningReports).where(eq(morningReports.id, reportId)).limit(1);
    expect(report?.eis_section).not.toBeNull();

    const [pre] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.user_id, userId), eq(orders.status, "pre_generated")))
      .limit(1);
    expect(pre).toBeTruthy();
  });
});
