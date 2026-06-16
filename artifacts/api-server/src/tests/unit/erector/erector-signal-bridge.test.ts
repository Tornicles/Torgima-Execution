import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypes } from "../../../types/eventContracts.js";
import {
  ERECTOR_BRIDGE_SIGNAL_TYPES,
  handleErectorSignalBridgeJob,
  shouldRecalculateErectorSignals,
} from "../../../workers/erector-signal-bridge-worker.js";
import { handleErectorSignalCalculatedJob } from "../../../workers/erector-simulation-worker.js";
import { detectResimulationTriggers } from "../../../engines/erector/simulation/ResimulationTriggerSystem.js";
import { WORKER_REGISTRY } from "../../../workers/WorkerRegistry.js";

const writeEventMock = vi.fn().mockResolvedValue(undefined);
const runErectorSignalEngineMock = vi.fn();
const checkResimulationTriggersMock = vi.fn();
const errorInserts: Array<Record<string, unknown>> = [];

let launchContractRow: { id: string } | null = { id: "contract-1" };
let latestSignalGeneratedAt: Date | null = null;
let selectCall = 0;

function chain(result: unknown) {
  const rows = Array.isArray(result) ? result : [result];
  const c = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(rows)),
    values: vi.fn().mockImplementation((row: Record<string, unknown>) => {
      errorInserts.push(row);
      return c;
    }),
  };
  return c;
}

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_SIGNAL_CALCULATED: "erector_signal_calculated",
    ERECTOR_RESIMULATION_TRIGGERED: "erector_resimulation_triggered",
  },
  writeEvent: (...args: unknown[]) => writeEventMock(...args),
}));

vi.mock("../../../engines/erector/signals/ErectorSignalEngine.js", () => ({
  runErectorSignalEngine: (...args: unknown[]) => runErectorSignalEngineMock(...args),
}));

vi.mock("../../../engines/erector/simulation/ResimulationTriggerSystem.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../engines/erector/simulation/ResimulationTriggerSystem.js")>();
  return {
    ...actual,
    checkResimulationTriggers: (...args: unknown[]) => checkResimulationTriggersMock(...args),
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => {
      selectCall += 1;
      if (selectCall % 2 === 1) {
        return chain(launchContractRow ? [launchContractRow] : []);
      }
      return chain(latestSignalGeneratedAt ? [{ generated_at: latestSignalGeneratedAt }] : []);
    }),
    insert: vi.fn(() => chain(undefined)),
  },
  erectorBlueprintLaunchContracts: {
    id: "id",
    blueprint_id: "blueprint_id",
    consumed: "consumed",
  },
  erectorSignals: {
    generated_at: "generated_at",
    user_id: "user_id",
    blueprint_id: "blueprint_id",
    status: "status",
  },
  erectorSystemErrorRecords: {},
}));

describe("erector-signal-bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCall = 0;
    launchContractRow = { id: "contract-1" };
    latestSignalGeneratedAt = null;
    errorInserts.length = 0;
    runErectorSignalEngineMock.mockResolvedValue(
      ERECTOR_BRIDGE_SIGNAL_TYPES.map((signal_type) => ({
        signal_type,
        value: 50,
        confidence: "MEDIUM",
        source_evidence_ids: [],
        source_execution_data: {},
        calculation_method: "execution_signal_bridge",
      })),
    );
    checkResimulationTriggersMock.mockResolvedValue({
      should_resimulate: false,
      triggers: [],
      changed_signals: [],
    });
  });

  it("registers ErectorSignalBridgeWorker in WorkerRegistry", () => {
    expect(WORKER_REGISTRY.ErectorSignalBridgeWorker).toMatchObject({
      consumes: [EventTypes.SIGNAL_CALCULATED],
      produces: [EventTypes.ERECTOR_SIGNAL_CALCULATED],
      lockScope: "NONE",
      retryPolicy: "FAST",
      timeoutMs: 15_000,
    });
  });

  it("TEST 1: signal_calculated triggers Erector signal update for active launch contract", async () => {
    const result = await handleErectorSignalBridgeJob({
      eventId: "evt-1",
      eventType: EventTypes.SIGNAL_CALCULATED,
      entityType: "signal_snapshot",
      entityId: "snap-1",
      userId: "user-1",
      blueprintId: "bp-1",
      payload: { signal_snapshot_id: "snap-1" },
    });

    expect(result.success).toBe(true);
    expect(runErectorSignalEngineMock).toHaveBeenCalledWith({
      userId: "user-1",
      blueprintId: "bp-1",
    });
    expect(writeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "erector_signal_calculated",
        blueprintId: "bp-1",
        payload: expect.objectContaining({
          signals_updated: ERECTOR_BRIDGE_SIGNAL_TYPES.length,
          trigger_source: "execution_signal_update",
        }),
      }),
    );
  });

  it("TEST 2: skips Erector signal update when no consumed launch contract", async () => {
    launchContractRow = null;

    const result = await handleErectorSignalBridgeJob({
      eventId: "evt-2",
      eventType: EventTypes.SIGNAL_CALCULATED,
      entityType: "signal_snapshot",
      userId: "user-1",
      blueprintId: "onboarding-bp",
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.reason).toBe("NO_ERECTOR_LAUNCH_CONTRACT");
    expect(runErectorSignalEngineMock).not.toHaveBeenCalled();
    expect(writeEventMock).not.toHaveBeenCalled();
  });

  it("TEST 3: frequency control prevents duplicate runs within 4 hours", async () => {
    latestSignalGeneratedAt = new Date(Date.now() - 60 * 60 * 1000);
    selectCall = 1;

    const shouldRun = await shouldRecalculateErectorSignals("user-1", "bp-1");
    expect(shouldRun).toBe(false);

    selectCall = 0;
    const result = await handleErectorSignalBridgeJob({
      eventId: "evt-3",
      eventType: EventTypes.SIGNAL_CALCULATED,
      entityType: "signal_snapshot",
      userId: "user-1",
      blueprintId: "bp-1",
      payload: {},
    });

    expect(result.reason).toBe("FREQUENCY_GATE");
    expect(runErectorSignalEngineMock).not.toHaveBeenCalled();
  });

  it("TEST 4: ResimulationTriggerSystem receives updated signals and emits resimulation", async () => {
    checkResimulationTriggersMock.mockResolvedValue({
      should_resimulate: true,
      triggers: ["signal_shift_detector"],
      changed_signals: ["OUTCOME_MOVEMENT_SIGNAL"],
    });

    const triggers = detectResimulationTriggers({
      tier: "growth",
      blueprintActiveDays: 30,
      outcomeMovementDelta14d: -30,
      demandSignalDelta: 0,
      highEvidenceSubmittedLast7d: false,
      falseProgressSignal: 0,
      openHighSeverityFlags: 0,
      consecutivePhaseGateFailures: 0,
      marketSignalDelta7d: 0,
    });
    expect(triggers).toContain("signal_shift_detector");

    const result = await handleErectorSignalCalculatedJob({
      eventId: "evt-4",
      eventType: EventTypes.ERECTOR_SIGNAL_CALCULATED,
      entityType: "blueprint",
      userId: "user-1",
      blueprintId: "bp-1",
      payload: { signals_updated: 8 },
    });

    expect(result.success).toBe(true);
    expect(writeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "erector_resimulation_triggered",
        payload: expect.objectContaining({
          trigger_type: "signal_shift_detector",
          changed_signals: ["OUTCOME_MOVEMENT_SIGNAL"],
        }),
      }),
    );
  });

  it("TEST 5: bridge worker failure is non-blocking and writes system error", async () => {
    runErectorSignalEngineMock.mockRejectedValue(new Error("engine exploded"));

    const result = await handleErectorSignalBridgeJob({
      eventId: "evt-5",
      eventType: EventTypes.SIGNAL_CALCULATED,
      entityType: "signal_snapshot",
      userId: "user-1",
      blueprintId: "bp-1",
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.reason).toBe("SIGNAL_CALCULATION_FAILED_NON_BLOCKING");
    expect(errorInserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          error_type: "SIGNAL_CALCULATION_FAILED",
          source_engine: "ErectorSignalBridgeWorker",
        }),
      ]),
    );
    expect(writeEventMock).not.toHaveBeenCalled();
  });
});
