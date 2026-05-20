/**
 * Bhudhi B3 — Memory, context control, and token budget (T1–T5).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let memorySelectResult: unknown[] = [];
let tokenSumResult = 0;
let insertPayload: Record<string, unknown> | null = null;

function drizzleSelectChain(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy, limit }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => drizzleSelectChain(memorySelectResult)),
    insert: vi.fn(() => ({
      values: vi.fn((payload: Record<string, unknown>) => {
        insertPayload = payload;
        return Promise.resolve();
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
  bhudhiMemory: {
    user_id: "user_id",
    memory_type: "memory_type",
    content: "content",
    content_json: "content_json",
    active: "active",
    disabled_at: "disabled_at",
    relevance_score: "relevance_score",
    confidence: "confidence",
    expires_at: "expires_at",
    blueprint_id: "blueprint_id",
  },
  blueprints: {
    id: "id",
    goal: "goal",
    purpose: "purpose",
    state_version: "state_version",
    current_condition: "current_condition",
  },
  conditions: { blueprint_id: "blueprint_id", is_current: "is_current", condition: "condition" },
  enforcementPackages: {
    blueprint_id: "blueprint_id",
    is_current: "is_current",
    allowed_actions: "allowed_actions",
    blocked_actions: "blocked_actions",
  },
  orders: { blueprint_id: "blueprint_id", status: "status" },
  bhudhiLogs: {
    user_id: "user_id",
    created_at: "created_at",
    token_count_in: "token_count_in",
  },
  users: { id: "id", tier: "tier" },
}));

vi.mock("../../../engines/world-model/WorldModelEngine.js", () => ({
  getWorldModel: vi.fn().mockResolvedValue({ stateVersion: 1 }),
}));

vi.mock("../../../bhudhi/PromptRegistry.js", () => ({
  getContract: vi.fn((trigger: string) => ({
    mode: "DRAFT",
    name: "task.draft.v3",
    memoryAllowed:
      trigger === "TASK_DRAFTING" ||
      trigger === "FEEDBACK_CLASSIFICATION" ||
      trigger === "GOAL_STRUCTURING",
    maxTokens: 1024,
  })),
}));

describe("B3 context sanitizer (T1)", () => {
  it("strips secrets from context facts", async () => {
    const { stripSecretsFromRecord } = await import("../../../bhudhi/contextSanitizer.js");
    const cleaned = stripSecretsFromRecord({
      userId: "user-1",
      goal: "Ship feature",
      api_key: "sk-live-abcdefghijklmnopqrstuvwxyz",
      password: "hunter2",
    });

    expect(cleaned.goal).toBe("Ship feature");
    expect(cleaned.api_key).toBe("[REDACTED]");
    expect(cleaned.password).toBe("[REDACTED]");
    expect(JSON.stringify(cleaned)).not.toMatch(/sk-live/);
    expect(JSON.stringify(cleaned)).not.toMatch(/hunter2/);
  });

});

describe("B3 Memory read policy (T2, T3)", () => {
  beforeEach(() => {
    vi.resetModules();
    memorySelectResult = [];
    insertPayload = null;
  });

  it("policy allows FRICTION_PATTERN only for FEEDBACK_CLASSIFICATION", async () => {
    const { allowedMemoryTypesForTrigger } = await import("../../../bhudhi/memoryPolicy.js");
    expect(allowedMemoryTypesForTrigger("FEEDBACK_CLASSIFICATION")).toContain("FRICTION_PATTERN");
    expect(allowedMemoryTypesForTrigger("GOAL_STRUCTURING")).not.toContain("FRICTION_PATTERN");
  });

  it("retrieveMemory returns friction content for FEEDBACK_CLASSIFICATION", async () => {
    memorySelectResult = [
      { memory_type: "FRICTION_PATTERN", content: "User stalls on proof upload", content_json: {} },
    ];
    const { db } = await import("@workspace/db");
    vi.mocked(db.select).mockImplementation(() => drizzleSelectChain(memorySelectResult) as never);

    const { retrieveMemory } = await import("../../../bhudhi/MemoryService.js");
    const fb = await retrieveMemory({ userId: "u1", triggerType: "FEEDBACK_CLASSIFICATION" });
    expect(fb).toContain("proof upload");
  });

  it("caps memory summary at 3 items", async () => {
    memorySelectResult = [
      { memory_type: "USER_PREFERENCE", content: "one", content_json: {} },
      { memory_type: "CAPABILITY_NOTE", content: "two", content_json: {} },
      { memory_type: "USER_PREFERENCE", content: "three", content_json: {} },
    ];
    const { db } = await import("@workspace/db");
    vi.mocked(db.select).mockImplementation(() => drizzleSelectChain(memorySelectResult) as never);

    const { retrieveMemory } = await import("../../../bhudhi/MemoryService.js");
    const summary = await retrieveMemory({ userId: "u1", triggerType: "TASK_DRAFTING" });
    const parts = summary.split(" | ");
    expect(parts.length).toBeLessThanOrEqual(3);
    expect(parts).toEqual(["one", "two", "three"]);
  });
});

describe("B3 MemoryWriter (T4)", () => {
  beforeEach(() => {
    vi.resetModules();
    insertPayload = null;
  });

  it("truncates memory content to 500 characters", async () => {
    const { MemoryWriter } = await import("../../../bhudhi/MemoryWriter.js");
    await MemoryWriter.write({
      userId: "u1",
      memoryType: "USER_PREFERENCE",
      scope: "USER",
      content: "x".repeat(1000),
      sourceType: "FEEDBACK",
      confidence: "MEDIUM",
    });

    expect(insertPayload).not.toBeNull();
    const content = String(insertPayload?.content ?? "");
    expect(content.length).toBeLessThanOrEqual(503);
  });
});

describe("B3 UsageController token budget (T5)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.BHUDHI_DAILY_TOKEN_LIMIT = "1000";
    tokenSumResult = 1500;
  });

  it("returns false when daily token budget is exhausted", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ total: tokenSumResult }]),
          })),
        }) as never,
    );

    const { UsageController } = await import("../../../bhudhi/UsageController.js");
    const ok = await UsageController.check("user-over-budget", "TASK_DRAFTING");
    expect(ok).toBe(false);
  });
});
