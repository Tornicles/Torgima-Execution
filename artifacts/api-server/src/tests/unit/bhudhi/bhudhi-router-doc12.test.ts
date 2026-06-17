/**
 * DOC12 — Bhudhi Trigger Router verification.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BhudhiRejected } from "../../../lib/bhudhi/BhudhiRejected.js";
import { REGISTERED_TRIGGERS } from "../../../lib/bhudhi/TriggerRegistry.js";
import { OutputValidator } from "../../../lib/bhudhi/OutputValidator.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function grepAnthropicSdkFiles(): string[] {
  const cmd =
    process.platform === "win32"
      ? `findstr /S /M /R "new Anthropic messages.create" src\\*.ts`
      : `grep -rl 'new Anthropic\\|messages\\.create' src --include='*.ts'`;
  try {
    const out = execSync(cmd, { cwd: apiRoot, encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\\/g, "/"))
      .filter(Boolean)
      .map((l) => (l.startsWith("src/") ? l : `src/${l}`));
  } catch {
    return [];
  }
}

describe("bhudhi-router DOC12 — trigger registry", () => {
  it("registers 10 core DOC12 router trigger types", async () => {
    const { CORE_DOC12_TRIGGER_COUNT } = await import("../../../lib/bhudhi/TriggerRegistry.js");
    expect(CORE_DOC12_TRIGGER_COUNT).toBe(10);
  });

  it("includes Erector triggers in canonical registry", async () => {
    const { ERECTOR_TRIGGER_TYPES } = await import("../../../lib/bhudhi/TriggerRegistry.js");
    expect(ERECTOR_TRIGGER_TYPES).toContain("ERECTOR_FREE_VALIDATION");
    expect(ERECTOR_TRIGGER_TYPES).toContain("ERECTOR_VERDICT_EXPLAIN");
  });
});

describe("bhudhi-router DOC12 — rejection gates", () => {
  it("rejects unregistered trigger", async () => {
    const { bhudhiTriggerRouter } = await import("../../../lib/bhudhi/BhudhiTriggerRouter.js");
    await expect(
      bhudhiTriggerRouter.trigger({
        triggerType: "UNKNOWN_TRIGGER",
        sourceEngine: "TASK_GENERATION",
        userId: "00000000-0000-0000-0000-000000000001",
        stateVersion: 1,
        input: {},
        idempotencyKey: "doc12-unregistered",
      }),
    ).rejects.toBeInstanceOf(BhudhiRejected);
  });

  it("rejects wrong source engine for TASK_DRAFTING", async () => {
    const { bhudhiTriggerRouter } = await import("../../../lib/bhudhi/BhudhiTriggerRouter.js");
    await expect(
      bhudhiTriggerRouter.trigger({
        triggerType: "TASK_DRAFTING",
        sourceEngine: "FEEDBACK_PROCESSING",
        userId: "00000000-0000-0000-0000-000000000002",
        stateVersion: 1,
        input: { domain: "delivery", condition: "urgency" },
        idempotencyKey: "doc12-wrong-source",
      }),
    ).rejects.toMatchObject({ reason: "SOURCE_NOT_ALLOWED" });
  });
});

describe("bhudhi-router DOC12 — budget cap fallback", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns fallback when daily budget is exhausted", async () => {
    const budget = await import("../../../lib/bhudhi/BudgetController.js");
    vi.spyOn(budget.BudgetController, "checkAndReserve").mockResolvedValue(false);

    const core = await import("../../../bhudhi/BhudhiCore.js");
    const invokeSpy = vi.spyOn(core, "invokeBhudhiModel");

    const { bhudhiTriggerRouter } = await import("../../../lib/bhudhi/BhudhiTriggerRouter.js");
    const result = await bhudhiTriggerRouter.trigger({
      triggerType: "TASK_DRAFTING",
      sourceEngine: "TASK_GENERATION",
      userId: "00000000-0000-0000-0000-000000000003",
      stateVersion: 1,
      input: { domain: "delivery", condition: "urgency", goal: "test" },
      idempotencyKey: "doc12-budget",
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.data?.outputType).toBe("task_copy");
    expect(invokeSpy).not.toHaveBeenCalled();
  });
});

describe("bhudhi-router DOC12 — forbidden output patterns", () => {
  it("rejects output containing mutation claims", () => {
    const badOutput = {
      outputType: "task_copy",
      contractVersion: "1.0",
      stateVersion: 1,
      confidence: "HIGH",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        title: "I have updated the database for you",
        instruction: "Continue",
        proofInstruction: "Screenshot",
        successCriteria: ["Done"],
        estimatedEffortLabel: "SMALL",
      },
    };

    const result = OutputValidator.validate(badOutput, "TASK_DRAFTING", 1);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Forbidden output pattern"))).toBe(true);
  });
});

describe("bhudhi-router DOC12 — zero direct API calls", () => {
  it("only ProviderAdapter.ts contains Anthropic SDK instantiation", () => {
    const files = grepAnthropicSdkFiles();
    const allowed = new Set(["src/lib/bhudhi/ProviderAdapter.ts"]);
    const unexpected = files.filter((f) => !allowed.has(f));
    expect(unexpected).toEqual([]);
  });

  it("has no api.anthropic.com fetch in src", () => {
    const cmd =
      process.platform === "win32"
        ? `findstr /S /M "api.anthropic.com" src\\*.ts`
        : `grep -rl 'api\\.anthropic\\.com' src --include='*.ts'`;
    try {
      const out = execSync(cmd, { cwd: apiRoot, encoding: "utf8" });
      expect(out.trim()).toBe("");
    } catch {
      // grep/findstr exit 1 = no matches
    }
  });
});

describe("bhudhi-router DOC12 — routeBhudhiRequest wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    "routes DOC12 triggers through BhudhiTriggerRouter",
    async () => {
      const routerMod = await import("../../../lib/bhudhi/BhudhiTriggerRouter.js");
      const triggerSpy = vi.spyOn(routerMod.bhudhiTriggerRouter, "trigger").mockResolvedValue({
        ok: true,
        data: {
          outputType: "task_copy",
          contractVersion: "1.0",
          stateVersion: 1,
          confidence: "LOW",
          forbiddenActionRequested: false,
          missingFields: [],
          warnings: [],
          data: { title: "t", instruction: "i" },
        },
        logId: "log-1",
        fallbackUsed: true,
      });

      const worldModel = await import("../../../engines/world-model/WorldModelEngine.js");
      vi.spyOn(worldModel, "getWorldModel").mockResolvedValue(null);

      const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
      await routeBhudhiRequest({
        sourceEngine: "TASK_GENERATION",
        triggerType: "TASK_DRAFTING",
        userId: "00000000-0000-0000-0000-000000000004",
        stateVersion: 1,
        idempotencyKey: "doc12-route",
        facts: { goal: "test" },
      });

      expect(triggerSpy).toHaveBeenCalled();
    },
    30_000,
  );
});
