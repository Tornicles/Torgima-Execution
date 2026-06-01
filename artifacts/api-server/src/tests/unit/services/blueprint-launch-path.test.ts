import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationKind, ValidationStatus } from "@workspace/state-machine";

const selectValidationPath = vi.fn().mockResolvedValue({ selected: true, blueprintContract: {} });
const getValidationByContractId = vi.fn();
const assertLaunchAllowed = vi.fn().mockResolvedValue(undefined);
const findById = vi.fn();
const configureSelection = vi.fn().mockResolvedValue(undefined);
const activateBlueprint = vi.fn().mockResolvedValue({ launched: true, blueprintId: "bp-1" });

vi.mock("../../../repositories/BlueprintRepository.js", () => ({
  BlueprintRepository: { findById },
}));

const finalizeValidation = vi.fn().mockResolvedValue({
  id: "val-1",
  is_finalized: true,
  selected_path: "current",
  selected_path_type: "current",
});

vi.mock("../../../services/ValidationService.js", () => ({
  ValidationService: {
    getValidationByContractId,
    selectValidationPath,
    assertLaunchAllowed,
  },
}));

vi.mock("../../../services/ValidationFinalizationService.js", () => ({
  requiresLaunchFinalization: vi.fn(() => false),
  ValidationFinalizationService: { finalizeValidation },
}));

vi.mock("../../../engines/blueprint/BlueprintEngine.js", () => ({
  BlueprintEngine: class {
    configureSelection = configureSelection;
    activateBlueprint = activateBlueprint;
  },
}));

vi.mock("../../../lib/verifySchema.js", () => ({
  verifyBlueprintLaunchSchema: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../../lib/transitionBlueprintToPathSelection.js", () => ({
  ensureBlueprintReadyForLaunch: vi.fn().mockResolvedValue(undefined),
  transitionBlueprintToPathSelection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@workspace/db", () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })) },
  blueprints: {},
}));

vi.mock("../../../services/SequenceTrackingService.js", () => ({
  SequenceTrackingService: {
    recordBlueprintTier: vi.fn().mockResolvedValue(undefined),
    recordLaunchStack: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../engines/sequence/sequenceExecutionStructureService.js", () => ({
  recordExecutionStructureFromBlueprint: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../engines/sequence/sequenceTaskQueueService.js", () => ({
  syncTaskGenerationSequence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../engines/mini-plan/MiniPlanAllocationEngine.js", () => ({
  initializeStarterAllocation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../engines/task-engine/TaskEngine.js", () => ({
  fillBlueprintTaskQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/PermanentFrameworkSignalService.js", () => ({
  initializePermanentFrameworkSignals: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../engines/sequence/SequenceTracker.js", () => ({
  SequenceTracker: {
    recordLaunch: vi.fn().mockResolvedValue(undefined),
    recordCheckpoint: vi.fn().mockResolvedValue(undefined),
    advanceSequence: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../engines/growth/KnowledgeService.js", () => ({
  KnowledgeService: {
    seedFromBlueprint: vi.fn().mockResolvedValue(undefined),
    seedKnowledgeCards: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("BlueprintLaunchService path gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue({
      id: "bp-1",
      status: "draft",
      mode: "individual",
      tier: "growth",
      goal: "g",
      purpose: "p",
    });
  });

  it("launches when validation has no selected_path but launch provides path", async () => {
    getValidationByContractId
      .mockResolvedValueOnce({
        id: "val-1",
        blueprint_id: "bp-1",
        user_id: "u-1",
        contract_id: "contract-1",
        verdict: "proceed",
        validation_kind: ValidationKind.INTELLIGENCE,
        status: ValidationStatus.COMPLETE,
        selected_path: null,
        selected_path_type: null,
      })
      .mockResolvedValueOnce({
        id: "val-1",
        blueprint_id: "bp-1",
        user_id: "u-1",
        contract_id: "contract-1",
        verdict: "proceed",
        validation_kind: ValidationKind.INTELLIGENCE,
        status: ValidationStatus.COMPLETE,
        selected_path: "current",
        selected_path_type: "current",
      });

    const { BlueprintLaunchService } = await import("../../../services/BlueprintLaunchService.js");

    await expect(
      BlueprintLaunchService.launch({
        blueprintId: "bp-1",
        userId: "u-1",
        validationContractId: "contract-1",
        selectedPathType: "current",
        selectedBlueprintLevel: "growth",
      }),
    ).resolves.toEqual({ launched: true, blueprintId: "bp-1" });

    expect(selectValidationPath).toHaveBeenCalledWith(
      expect.objectContaining({ selectedPath: "current" }),
    );
  });
});
