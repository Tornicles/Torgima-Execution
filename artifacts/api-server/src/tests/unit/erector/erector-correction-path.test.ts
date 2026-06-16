import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateEconomicCorrection, listSupportedArchetypes } from "../../../engines/erector/EconomicCorrectionGenerator.js";

const { mockSelectChain, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockSelectChain: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: mockSelectChain,
    insert: mockInsert,
    update: mockUpdate,
  },
  erectorCorrectionPaths: {
    id: "id",
    user_id: "user_id",
    blueprint_id: "blueprint_id",
    correction_type: "correction_type",
    source_id: "source_id",
    status: "status",
    validation_run_id: "validation_run_id",
  },
  erectorValidationRuns: { id: "id", verdict: "verdict", selected_path: "selected_path" },
  erectorSimulationRuns: {
    hard_vetoes: "hard_vetoes",
    probability_proceed: "probability_proceed",
    validation_run_id: "validation_run_id",
    created_at: "created_at",
  },
  erectorEvidenceLedger: {
    blueprint_id: "blueprint_id",
    evidence_strength: "evidence_strength",
    contradiction_status: "contradiction_status",
    created_at: "created_at",
  },
  falseProgressFlags: {
    blueprint_id: "blueprint_id",
    resolved: "resolved",
    false_progress_score: "false_progress_score",
  },
  erectorCapabilityGaps: {
    user_id: "user_id",
    blueprint_id: "blueprint_id",
    blocks_execution: "blocks_execution",
    status: "status",
    capability_id: "capability_id",
  },
  erectorCapabilityProfiles: {
    user_id: "user_id",
    capability_id: "capability_id",
    capability_signal: "capability_signal",
  },
  erectorCapabilityGraph: {
    capability_id: "capability_id",
    minimum_signal_threshold: "minimum_signal_threshold",
  },
  blueprints: { id: "id", current_phase_id: "current_phase_id", erector_archetype: "erector_archetype" },
  phases: {
    id: "id",
    blueprint_id: "blueprint_id",
    name: "name",
    target_id: "target_id",
    started_at: "started_at",
    created_at: "created_at",
  },
  erectorArchetypeRulePacks: { archetype_id: "archetype_id", required_phase_gates: "required_phase_gates" },
  erectorBlueprintLaunchContracts: {
    blueprint_id: "blueprint_id",
    consumed: "consumed",
    required_phase_gates: "required_phase_gates",
  },
  erectorPhaseGates: { id: "id", evaluated_at: "evaluated_at" },
  targets: { id: "id", blueprint_id: "blueprint_id", status: "status" },
  outcomeValidations: {
    blueprint_id: "blueprint_id",
    target_id: "target_id",
    validation_result: "validation_result",
  },
}));

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_CORRECTION_RESOLVED: "erector_correction_resolved",
    PHASE_GATE_PASSED: "phase_gate_passed",
    PHASE_GATE_FAILED: "phase_gate_failed",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

function buildSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
}

function mockUpdateChain() {
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

describe("correction-path engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens VALIDATION_ADJUST correction path with required actions", async () => {
    const { openCorrectionPath } = await import("../../../engines/erector/CorrectionPathEngine.js");

    mockSelectChain.mockReturnValueOnce(buildSelectChain([]));
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "path-1" }]),
      }),
    });

    const id = await openCorrectionPath({
      userId: "user-1",
      blueprintId: "bp-1",
      validationRunId: "vr-1",
      sourceEngine: "ErectorValidationOrchestrator",
      sourceId: "vr-1",
      correctionType: "VALIDATION_ADJUST",
      blockedAction: "blueprint_launch",
      reason: "Adjust intake fields",
      userVisibleReason: "Your validation requires corrections before launch.",
      requiredActions: ["timeline_launch", "budget_range"],
      revalidationRequired: true,
      unblockCondition: "Revalidation returns PROCEED verdict",
    });

    expect(id).toBe("path-1");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("resolves correction path when validation verdict is PROCEED", async () => {
    const { checkUnblockCondition } = await import("../../../engines/erector/CorrectionPathEngine.js");

    mockSelectChain
      .mockReturnValueOnce(
        buildSelectChain([
          {
            id: "path-1",
            user_id: "user-1",
            blueprint_id: "bp-1",
            validation_run_id: "vr-1",
            source_engine: "ErectorValidationOrchestrator",
            source_id: "vr-1",
            correction_type: "VALIDATION_ADJUST",
            blocked_action: "blueprint_launch",
            reason: "Adjust",
            user_visible_reason: "Fix intake",
            required_actions: ["timeline_launch"],
            required_evidence: [],
            revalidation_required: true,
            unblock_condition: "Revalidation returns PROCEED verdict",
            status: "open",
            resolved_at: null,
            resolved_by: null,
            created_at: new Date(),
          },
        ]),
      )
      .mockReturnValueOnce(buildSelectChain([{ verdict: "PROCEED" }]));

    const result = await checkUnblockCondition("path-1");
    expect(result.met).toBe(true);
    expect(result.still_needed).toEqual([]);
  });

  it("generates marketplace chicken-and-egg economic correction", () => {
    const spec = generateEconomicCorrection({
      archetype: "marketplace_exchange",
      failureType: "low_probability",
      probabilityProceed: 20,
    });

    expect(spec.core_correction).toContain("chicken-and-egg");
    expect(spec.required_actions.some((action) => /10 transactions/i.test(action))).toBe(true);
    expect(listSupportedArchetypes()).toHaveLength(10);
  });
});

describe("phase-gate engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockUpdateChain();
  });

  it("returns PASSED when all default criteria are met", async () => {
    const { evaluatePhaseGate } = await import("../../../engines/erector/PhaseGateEngine.js");

    let selectCall = 0;
    mockSelectChain.mockImplementation(() => {
      selectCall += 1;
      switch (selectCall) {
        case 1:
          return buildSelectChain([
            {
              id: "phase-1",
              name: "foundation",
              blueprint_id: "bp-1",
              target_id: null,
              started_at: new Date("2026-01-01"),
              created_at: new Date("2026-01-01"),
            },
          ]);
        case 2:
          return buildSelectChain([
            { erector_archetype: "direct_service_delivery", current_phase_id: "phase-1" },
          ]);
        case 3:
          return buildSelectChain([{ required_phase_gates: [] }]);
        case 4:
          return buildSelectChain([]);
        case 5:
          return buildSelectChain([
            {
              id: "ev-1",
              evidence_class: "PAYMENT_PROOF",
              evidence_strength: "HIGH",
              submitted_at: new Date("2026-02-01"),
            },
          ]);
        default:
          return buildSelectChain([]);
      }
    });

    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "gate-1" }]),
      }),
    });

    const result = await evaluatePhaseGate({
      userId: "user-1",
      blueprintId: "bp-1",
      phaseId: "phase-1",
    });

    expect(result.gate_result).toBe("PASSED");
    expect(result.readiness_score).toBeGreaterThanOrEqual(80);
  });

  it("returns BLOCKED and opens PHASE_GATE_BLOCK correction when criteria fail", async () => {
    const { evaluatePhaseGate } = await import("../../../engines/erector/PhaseGateEngine.js");

    let selectCall = 0;
    mockSelectChain.mockImplementation(() => {
      selectCall += 1;
      switch (selectCall) {
        case 1:
          return buildSelectChain([
            {
              id: "phase-1",
              name: "foundation",
              blueprint_id: "bp-1",
              target_id: "target-1",
              started_at: new Date("2026-01-01"),
              created_at: new Date("2026-01-01"),
            },
          ]);
        case 2:
          return buildSelectChain([
            { erector_archetype: "direct_service_delivery", current_phase_id: "phase-1" },
          ]);
        case 3:
          return buildSelectChain([{ required_phase_gates: [] }]);
        case 4:
          return buildSelectChain([]);
        case 5:
          return buildSelectChain([]);
        case 6:
          return buildSelectChain([{ id: "flag-1", severity: "CRITICAL", resolved: false }]);
        case 7:
          return buildSelectChain([{ id: "gap-1" }]);
        case 8:
          return buildSelectChain([]);
        default:
          return buildSelectChain([]);
      }
    });

    mockInsert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "gate-2" }]),
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "path-2" }]),
        }),
      });

    const result = await evaluatePhaseGate({
      userId: "user-1",
      blueprintId: "bp-1",
      phaseId: "phase-1",
    });

    expect(result.gate_result).toBe("BLOCKED");
    expect(result.readiness_score).toBeLessThan(50);
    expect(result.correction_path_id).toBe("path-2");
  });
});
