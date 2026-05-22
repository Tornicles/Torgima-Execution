/**
 * Prompt 5 — Erector additions in execution loops
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { archetypeSignalWindowDays } from "../../../engines/erector/ArchetypeExecutionContext.js";
import { EventTypes } from "../../../types/eventContracts.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Prompt 5 Erector execution loop additions", () => {
  it("high-pressure economies use a shorter rolling window than slow economies", () => {
    const highPressure = archetypeSignalWindowDays(1.5);
    const slow = archetypeSignalWindowDays(0.8);
    expect(highPressure).toBeLessThan(slow);
  });

  it("wires archetype context through primary, daily, and background loops", () => {
    const control = readRepo("artifacts/api-server/src/engines/control/ControlEngine.ts");
    const signal = readRepo("artifacts/api-server/src/engines/signal/SignalCalculationEngine.ts");
    const taskGen = readRepo("artifacts/api-server/src/engines/task-generation/TaskGenerationEngine.ts");
    const daily = readRepo("artifacts/api-server/src/engines/execution-loop/DailyLoopEngine.ts");
    const ctx = readRepo("artifacts/api-server/src/engines/erector/ArchetypeExecutionContext.ts");

    expect(control).toContain("applyArchetypeTaskLimitsWithLog");
    expect(ctx).toContain("[ConditionAssignment] Archetype mult applied");
    expect(signal).toContain("archetypeSignalWindowDays");
    expect(signal).toContain("executionLoop");
    expect(taskGen).toContain("archetype_difficulty_adj");
    expect(taskGen).toContain("[BackgroundLoop] Archetype difficulty adj applied");
    expect(daily).toContain("Archetype timeframe pressure");
    expect(ctx).toContain("emitArchetypeContextMissingIfNeeded");
    expect(EventTypes.ARCHETYPE_CONTEXT_MISSING).toBe("archetype_context_missing");
  });
});
