/**
 * DOC14 — Bhudhi memory and usage control verification.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const memoryRows: Array<{
  memory_type: string;
  content: string | null;
  content_json: Record<string, unknown>;
  expires_at?: Date | null;
}> = [];

function memorySelectChain() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where, limit }));
  return { from };
}

function memoryLoadChain() {
  const where = vi.fn().mockResolvedValue(memoryRows);
  const from = vi.fn(() => ({ where }));
  return { from };
}

let selectMode: "load" | "upsert" = "load";
let insertPayload: Record<string, unknown> | null = null;
let updateCalled = false;
let deleteCalled = false;

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => (selectMode === "upsert" ? memorySelectChain() : memoryLoadChain())),
    insert: vi.fn(() => ({
      values: vi.fn((payload: Record<string, unknown>) => {
        insertPayload = payload;
        return Promise.resolve();
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          updateCalled = true;
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "deleted-1" }]),
      })),
    })),
  },
  bhudhiMemory: {
    id: "id",
    user_id: "user_id",
    blueprint_id: "blueprint_id",
    memory_type: "memory_type",
    content: "content",
    content_json: "content_json",
    active: "active",
    disabled_at: "disabled_at",
    expires_at: "expires_at",
    reinforcement_count: "reinforcement_count",
    last_reinforced_at: "last_reinforced_at",
    updated_at: "updated_at",
    scope: "scope",
    source_type: "source_type",
    source_id: "source_id",
    confidence: "confidence",
    relevance_score: "relevance_score",
  },
  bhudhiLogs: {
    user_id: "user_id",
    created_at: "created_at",
    token_count_in: "token_count_in",
    token_count_out: "token_count_out",
    trigger_type: "trigger_type",
  },
  bhudhiUsageBudget: {
    user_id: "user_id",
    date_utc: "date_utc",
    total_calls: "total_calls",
    total_input_tokens: "total_input_tokens",
    total_output_tokens: "total_output_tokens",
    total_cost_cents: "total_cost_cents",
    calls_by_trigger: "calls_by_trigger",
  },
  featureFlags: {
    feature_name: "feature_name",
    enabled: "enabled",
    description: "description",
    id: "id",
  },
  systemHealthLogs: {},
  users: { id: "id", tier: "tier" },
}));

describe("bhudhi-memory DOC14 — memory service", () => {
  beforeEach(() => {
    memoryRows.length = 0;
    insertPayload = null;
    updateCalled = false;
    deleteCalled = false;
    selectMode = "load";
    vi.resetModules();
  });

  it("summarizes memory content to 200 chars or less", async () => {
    const { summarizeMemory } = await import("../../../lib/bhudhi/BhudhiMemoryService.js");
    const long = "x".repeat(400);
    expect(summarizeMemory({ summary: long }).length).toBeLessThanOrEqual(200);
  });

  it("GOAL_STRUCTURING receives no memory context", async () => {
    memoryRows.push({
      memory_type: "user_goal_summary",
      content: "Launch SaaS",
      content_json: { summary: "Launch SaaS" },
    });

    const { bhudhiMemoryService } = await import("../../../lib/bhudhi/BhudhiMemoryService.js");
    const memory = await bhudhiMemoryService.loadForTrigger(
      "user-1",
      "bp-1",
      "GOAL_STRUCTURING",
    );
    expect(memory).toEqual({});
  });

  it("TASK_DRAFTING injects permitted summarized memory", async () => {
    memoryRows.push(
      {
        memory_type: "user_goal_summary",
        content: "Build a SaaS for freelancers",
        content_json: { summary: "Build a SaaS for freelancers" },
      },
      {
        memory_type: "recent_task_context",
        content: "Completed onboarding tasks",
        content_json: { summary: "Completed onboarding tasks" },
      },
    );

    const { bhudhiMemoryService } = await import("../../../lib/bhudhi/BhudhiMemoryService.js");
    const memory = await bhudhiMemoryService.loadForTrigger("user-1", "bp-1", "TASK_DRAFTING");
    expect(memory.user_goal_summary).toBeTruthy();
    expect(memory.recent_task_context).toBeTruthy();
    expect(String(memory.user_goal_summary).length).toBeLessThanOrEqual(200);
  });

  it("upsert writes typed memory with expiry metadata", async () => {
    selectMode = "upsert";
    const { bhudhiMemoryService } = await import("../../../lib/bhudhi/BhudhiMemoryService.js");
    await bhudhiMemoryService.upsert(
      "user-1",
      "bp-1",
      "user_goal_summary",
      { summary: "Reach 50 customers in 6 months" },
      7,
    );
    expect(insertPayload?.memory_type).toBe("user_goal_summary");
    expect(insertPayload?.expires_at).toBeInstanceOf(Date);
  });
});

describe("bhudhi-memory DOC14 — context builder", () => {
  beforeEach(() => {
    memoryRows.length = 0;
    selectMode = "load";
    vi.resetModules();
  });

  it("buildContextPacket attaches memory_context for permitted triggers", async () => {
    memoryRows.push({
      memory_type: "pattern_summary",
      content: "Steady weekly progress",
      content_json: { summary: "Steady weekly progress" },
    });

    const { ContextBuilder } = await import("../../../lib/bhudhi/ContextBuilder.js");
    const packet = await ContextBuilder.buildContextPacket({
      input: { condition: "stability", signal_summary: "steady", next_action: "Finish task" },
      requiredFields: ["condition", "signal_summary", "next_action"],
      forbiddenFields: [],
      userId: "user-1",
      blueprintId: "bp-1",
      triggerType: "STATE_EXPLANATION",
    });

    expect(packet.memory_context).toBeTruthy();
    expect((packet.memory_context as Record<string, unknown>).pattern_summary).toBeTruthy();
  });
});

describe("bhudhi-memory DOC14 — budget control", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("estimateCostCents uses DOC14 formula", async () => {
    const { estimateCostCents } = await import("../../../lib/bhudhi/BudgetController.js");
    expect(estimateCostCents(1000, 500)).toBeCloseTo(1000 * 0.0003 + 500 * 0.0015, 5);
  });

  it("starter tier daily cap is enforced at 20 calls", async () => {
    const { BudgetController } = await import("../../../lib/bhudhi/BudgetController.js");
    expect(BudgetController.tierCaps.starter).toBe(20);
    expect(BudgetController.tierCaps.ultimate).toBe(100);
  });
});

describe("bhudhi-memory DOC14 — memory types", () => {
  it("defines 6 memory types with expiry defaults", async () => {
    const { DOC14_MEMORY_TYPES } = await import("../../../lib/bhudhi/BhudhiMemoryService.js");
    expect(Object.keys(DOC14_MEMORY_TYPES)).toHaveLength(6);
    expect(DOC14_MEMORY_TYPES.user_goal_summary).toBe(30);
    expect(DOC14_MEMORY_TYPES.friction_summary).toBe(3);
  });
});
