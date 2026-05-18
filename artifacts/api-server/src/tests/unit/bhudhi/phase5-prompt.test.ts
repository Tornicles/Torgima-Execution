/**
 * BHUDHI_CURSOR_PROMPT_5 — Execution loop, agents, knowledge, guarantee
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  CONDITION_TONE_MAP,
  normalizeCondition,
} from "../../../bhudhi/agents/conditionMaps.js";
import { getBehavioralProfile } from "../../../bhudhi/agents/ConditionAgent.js";
import {
  buildInitialKnowledgeLibrary,
  selectPackage,
} from "../../../bhudhi/agents/KnowledgeAgent.js";
import { getBasicProfile } from "../../../bhudhi/agents/BehavioralAgent.js";
import {
  diagnoseExecutionBlock,
  ensureActiveOrder,
} from "../../../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { getContract, getAllContracts } from "../../../bhudhi/PromptRegistry.js";
import { integrationEnabled } from "../../helpers/db.js";

const integration = integrationEnabled();

describe("Prompt 5 — Condition agent", () => {
  it("TEST 6: Nothingness maps to gentle_directive tone", () => {
    expect(CONDITION_TONE_MAP[normalizeCondition("nothingness")]).toBe("gentle_directive");
  });

  it("TEST 7: Power maps to challenging_scaling tone", () => {
    expect(CONDITION_TONE_MAP[normalizeCondition("power")]).toBe("challenging_scaling");
  });

  it.runIf(integration)("TEST 2-3: control profile exposes caps", async () => {
    const { createTestUser, createTestBlueprint, createInitialState, cleanupTestUser } =
      await import("../../helpers/db.js");
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { current_condition: "danger" });
    await createInitialState(bp.id, user.id);

    const profile = await getBehavioralProfile(user.id, bp.id);
    expect(profile.maxActiveTasks).toBeGreaterThanOrEqual(1);
    expect(profile.taskTone).toBe("corrective_focused");

    await cleanupTestUser(user.id);
  });
});

describe("Prompt 5 — Knowledge agent", () => {
  beforeAll(async () => {
    await buildInitialKnowledgeLibrary().catch(() => null);
  });

  it.runIf(integration)("TEST 4-5: knowledge package selection", async () => {
    const { createTestUser, cleanupTestUser } = await import("../../helpers/db.js");
    const user = await createTestUser();

    const first = await selectPackage({
      domain: "Content",
      actionType: "Create",
      userId: user.id,
    });
    expect(first).toBeTruthy();
    expect(first?.sop).toBeTruthy();

    const second = await selectPackage({
      domain: "Content",
      actionType: "Create",
      userId: user.id,
    });
    expect(second?.id).toBeTruthy();

    await cleanupTestUser(user.id);
  });
});

describe("Prompt 5 — Behavioral agent", () => {
  it.runIf(integration)("TEST 12: inactivity detection surface", async () => {
    const { createTestUser, cleanupTestUser } = await import("../../helpers/db.js");
    const user = await createTestUser();
    const profile = await getBasicProfile(user.id);
    expect(profile.inactiveHours).toBeGreaterThanOrEqual(0);
    await cleanupTestUser(user.id);
  });
});

describe("Prompt 5 — Prompt registry alignment", () => {
  it("TASK_DRAFTING uses task.draft.v3", () => {
    const c = getContract("TASK_DRAFTING");
    expect(c?.name).toBe("task.draft.v3");
    expect(c?.version).toBe("3.0");
  });

  it("EXECUTION_SUPPORT contract registered", () => {
    const c = getContract("EXECUTION_SUPPORT");
    expect(c?.name).toBe("task.execution_help.v1");
    expect(c?.outputType).toBe("execution_help");
  });

  it("registry count >= 16 after Prompt 5", () => {
    expect(getAllContracts().size).toBeGreaterThanOrEqual(16);
  });
});

describe("Prompt 5 — Continuous task guarantee", () => {
  it.runIf(integration)("TEST 8-10: ensureActiveOrder paths", async () => {
    const { createTestUser, createTestBlueprint, createInitialState, cleanupTestUser } =
      await import("../../helpers/db.js");
    const { db, orders } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id, { current_condition: "danger" });
    await createInitialState(bp.id, user.id);

    await db.delete(orders).where(eq(orders.blueprint_id, bp.id));

    const block = await diagnoseExecutionBlock(user.id, bp.id);
    expect(block).toBe("CONDITION_BLOCKS_NORMAL");

    const ensured = await ensureActiveOrder(user.id);
    expect(ensured.orderId).toBeTruthy();

    await cleanupTestUser(user.id);
  });
});

describe("Prompt 5 — Execution loop surfaces", () => {
  it("exports primary loop and generateNextTask", async () => {
    const mod = await import("../../../engines/execution-loop/index.js");
    expect(typeof mod.runPrimaryLoop).toBe("function");
    expect(typeof mod.generateNextTask).toBe("function");
    expect(typeof mod.runDailyLoop).toBe("function");
    expect(typeof mod.ensureActiveOrder).toBe("function");
  });
});
