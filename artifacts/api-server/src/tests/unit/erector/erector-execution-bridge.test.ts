/**
 * Prompt 4 — Erector → Execution Bridge
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyArchetypeToTaskLimits, parseFirstWeekPlan } from "../../../engines/erector/ErectorExecutionBridge.js";
import {
  archetypeSignalWindowDays,
  archetypeDifficultyShift,
  shiftDifficultyCap,
} from "../../../engines/erector/ArchetypeExecutionContext.js";
import { industryWeightForAction } from "../../../engines/erector/industryTaskWeights.js";
import { ERECTOR_BHUDHI_CALLS } from "../../../bhudhi/erector-prompts.js";
import { EventTypes } from "../../../types/eventContracts.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Erector execution bridge", () => {
  it("parses first week plan from days format into 7 items", () => {
    const items = parseFirstWeekPlan({
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        actions: [{ title: `Task ${i + 1}`, description: "Do proof", type: "execution", economyContext: "US" }],
      })),
    });
    expect(items).toHaveLength(7);
    expect(items[0]?.smokeTest).toBe(true);
    expect(items[0]?.title).toBe("Task 1");
  });

  it("applies archetype execution multiplier to task limits", () => {
    const base = applyArchetypeToTaskLimits(1, 3, 1.0);
    const boosted = applyArchetypeToTaskLimits(1, 3, 1.5);
    expect(boosted.max).toBeGreaterThan(base.max);
  });

  it("compresses signal window under high timeframe pressure (Prompt 5)", () => {
    expect(archetypeSignalWindowDays(1.0)).toBe(7);
    expect(archetypeSignalWindowDays(1.5)).toBeLessThan(7);
    expect(archetypeSignalWindowDays(0.8)).toBeGreaterThan(7);
  });

  it("shifts difficulty cap when archetype_difficulty_adj is high", () => {
    expect(archetypeDifficultyShift(0.5)).toBe(1);
    expect(shiftDifficultyCap("moderate", 1)).toBe("hard");
  });

  it("weights analyze higher than create for DECLINING industry", () => {
    const analyze = industryWeightForAction("DECLINING", "analyze");
    const create = industryWeightForAction("DECLINING", "create");
    expect(analyze).toBeGreaterThan(create);
  });

  it("registers 10 Erector Bhudhi calls", () => {
    expect(ERECTOR_BHUDHI_CALLS).toHaveLength(10);
  });

  it("migration and engine wire bridge at launch", () => {
    const migration = readRepo("scripts/migrations/manual-20260522-erector-execution-bridge.sql");
    expect(migration).toContain("smoke_test");
    expect(migration).toContain("industry_state");
    expect(migration).toContain("archetype_execution_mult");

    const engine = readRepo("artifacts/api-server/src/engines/blueprint/BlueprintEngine.ts");
    const bridge = readRepo("artifacts/api-server/src/engines/erector/ErectorExecutionBridge.ts");
    expect(engine).toContain("seedErectorFirstWeekOrders");
    expect(engine).toContain("blueprintSetFromLockedIntel");
    expect(bridge).toContain("erector_first_week_seed");

    expect(EventTypes.ERECTOR_BLUEPRINT_LAUNCHED).toBe("erector_blueprint_launched");
    expect(EventTypes.ERECTOR_VALIDATION_COMPLETED).toBe("erector_validation_completed");
  });
});
