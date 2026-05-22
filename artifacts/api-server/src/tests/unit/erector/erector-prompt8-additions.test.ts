/**
 * Prompt 8 — Erector event system additions
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EventTypes, EVENT_QUEUE_MAP, TERMINAL_EVENT_TYPES } from "../../../types/eventContracts.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("Prompt 8 Erector event additions", () => {
  it("registers all 7 Erector events with worker queues", () => {
    const events = [
      EventTypes.ERECTOR_VALIDATION_STARTED,
      EventTypes.ARCHETYPE_RESOLVED,
      EventTypes.ERECTOR_ENGINE_COMPLETED,
      EventTypes.ERECTOR_VALIDATION_COMPLETED,
      EventTypes.ERECTOR_PATH_SELECTED,
      EventTypes.ERECTOR_FIRST_WEEK_GENERATED,
      EventTypes.ERECTOR_BLUEPRINT_LAUNCHED,
    ];
    for (const evt of events) {
      expect(EVENT_QUEUE_MAP[evt]).toBe(evt);
      expect(TERMINAL_EVENT_TYPES.has(evt)).toBe(false);
    }
  });

  it("Erector workers registered in start.ts", () => {
    const start = readRepo("artifacts/api-server/src/workers/start.ts");
    expect(start).toContain("ErectorEventWorkers");
    const workers = readRepo("artifacts/api-server/src/workers/ErectorEventWorkers.ts");
    expect(workers).toContain("ErectorValidationStartedWorker");
    expect(workers).toContain("erector_first_week_seed");
    expect(workers).toContain("validation_stage");
  });

  it("DLQ handles Erector validation and launch failures", () => {
    const dlq = readRepo("artifacts/api-server/src/engines/event/EventSystem.ts");
    expect(dlq).toContain("handleErectorDlqRecovery");
    expect(dlq).toContain("validation_stage");
    expect(dlq).toContain("path_selection");
    expect(dlq).toContain("blueprint_launch_failed");
  });

  it("validation_pipeline health check runs from SystemHealthService", () => {
    const health = readRepo("artifacts/api-server/src/services/SystemHealthService.ts");
    expect(health).toContain("checkValidationPipeline");
    expect(health).toContain("validation_pipeline");
    expect(health).toContain("stuckValidations");
  });
});
