/**
 * Bhudhi B1 — TriggerRouter audit & wiring verification (T1–T5).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

describe("B1 TriggerRouter — SDK surface (T1)", () => {
  it("only TriggerRouter.ts contains Anthropic SDK instantiation", () => {
    const files = grepAnthropicSdkFiles();
    const allowed = new Set(["src/bhudhi/TriggerRouter.ts"]);
    const unexpected = files.filter((f) => !allowed.has(f));
    expect(unexpected).toEqual([]);
  });
});

describe("B1 TriggerRouter — banned modes (T3)", () => {
  it(
    "rejects requestedMode DECIDE without calling provider",
    async () => {
      const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
      const result = await routeBhudhiRequest({
        sourceEngine: "INTERNAL_WORKER",
        triggerType: "TASK_DRAFTING",
        userId: "00000000-0000-0000-0000-000000000099",
        stateVersion: 1,
        requestedMode: "DECIDE",
        idempotencyKey: "b1-t3-decide",
        facts: { goal: "test" },
      });
      expect(result.ok).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(result.failureReason).toMatch(/banned/i);
    },
    30_000,
  );
});

describe("B1 TriggerRouter — stale state (T5)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it(
    "returns fallback when stateVersion is stale vs world model",
    async () => {
      const worldModel = await import("../../../engines/world-model/WorldModelEngine.js");
      vi.spyOn(worldModel, "getWorldModel").mockResolvedValue({
        userId: "00000000-0000-0000-0000-000000000098",
        stateVersion: 5,
        userState: {
          energyLevel: 0.5,
          attentionQuality: 0.5,
          consistencyScore: 0.5,
          moraleLevel: 0.5,
          cognitiveLoad: 0.5,
          burnoutRisk: 0.5,
        },
        goalState: {
          blueprintHealthScore: 0.5,
          phaseProgressRate: 0.5,
          targetAchievementTrajectory: "on_track",
          daysToPhaseCompletion: null,
        },
        signalTrajectory: {
          completionRateTrend: "stable",
          completionRateDrift: 0,
          momentumTrend: "stable",
          momentumDrift: 0,
          confidenceTrend: "stable",
        },
        motivationState: {
          motivationLevel: 0.5,
          meaningAlignment: 0.5,
          noveltyDecayRate: 0.1,
        },
        marketState: {
          domainCondition: "neutral",
          lastEISUpdate: null,
          platformSignalScore: 0.5,
        },
        environmentalState: { lastUpdated: new Date().toISOString(), seasonalContext: null },
      });

      const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
      const result = await routeBhudhiRequest({
        sourceEngine: "TASK_GENERATION",
        triggerType: "TASK_DRAFTING",
        userId: "00000000-0000-0000-0000-000000000098",
        stateVersion: 3,
        idempotencyKey: `b1-t5-stale-${Date.now()}`,
        facts: { goal: "stale state test", domain: "delivery" },
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.ok).toBe(true);
      expect(result.failureReason).toBe("stale_state_version");
    },
    30_000,
  );
});

describe("B1 TriggerRouter — provider failure fallback (T4)", () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevAlt = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevKey) process.env.ANTHROPIC_API_KEY = prevKey;
    else delete process.env.ANTHROPIC_API_KEY;
    if (prevAlt) process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = prevAlt;
    else delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  });

  it(
    "uses deterministic fallback when API key is absent",
    async () => {
      const worldModel = await import("../../../engines/world-model/WorldModelEngine.js");
      vi.spyOn(worldModel, "getWorldModel").mockResolvedValue(null);

      const stability = await import("../../../engines/stability/StabilityEngine.js");
      vi.spyOn(stability, "checkTriggerAllowed").mockResolvedValue({ allowed: true });
      vi.spyOn(stability, "enterAgentChain").mockReturnValue({ allowed: true, depth: 0 });
      vi.spyOn(stability, "exitAgentChain").mockImplementation(() => undefined);

      const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
      const result = await routeBhudhiRequest({
        sourceEngine: "TASK_GENERATION",
        triggerType: "TASK_DRAFTING",
        userId: "00000000-0000-0000-0000-000000000097",
        stateVersion: 1,
        idempotencyKey: `b1-t4-no-key-${Date.now()}`,
        facts: {
          goal: "Launch product",
          domain: "delivery",
          taskType: "execution",
          actionTitle: "Plan",
          difficulty: "easy",
        },
      });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.output?.data).toBeTruthy();
    },
    30_000,
  );
});
