import { beforeEach, describe, expect, it, vi } from "vitest";
import { VALID_TRANSITIONS } from "../../../engines/erector/erectorStateMachine.js";

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
  blueprints: { id: "id", erector_state: "erector_state" },
  erectorSystemErrorRecords: { id: "id" },
  erectorBlueprintLaunchContracts: {
    id: "id",
    blueprint_id: "blueprint_id",
    consumed: "consumed",
    launch_permission: "launch_permission",
  },
  erectorCorrectionPaths: {
    id: "id",
    blueprint_id: "blueprint_id",
    status: "status",
    correction_type: "correction_type",
  },
}));

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ERECTOR_STATE_CHANGED: "erector_state_changed",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

function buildSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
}

describe("state-machine transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it("allows VERDICT_ISSUED to PATH_SELECTED when routed through PATH_SELECTION_REQUIRED is not needed for direct PATH_SELECTED from orchestrators", async () => {
    expect(VALID_TRANSITIONS.VERDICT_ISSUED).toContain("PATH_SELECTION_REQUIRED");
    expect(VALID_TRANSITIONS.PATH_SELECTION_REQUIRED).toContain("PATH_SELECTED");
  });

  it("rejects BLUEPRINT_ACTIVE to VALIDATION_RUNNING and logs system error", async () => {
    const { transition } = await import("../../../engines/erector/erectorStateMachine.js");

    mockSelectChain.mockReturnValueOnce(buildSelectChain([{ erector_state: "BLUEPRINT_ACTIVE" }]));
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const result = await transition("bp-1", "user-1", "VALIDATION_RUNNING", "test");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot transition from BLUEPRINT_ACTIVE to VALIDATION_RUNNING");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("allows LAUNCH_PERMITTED to BLUEPRINT_ACTIVE", async () => {
    const { transition } = await import("../../../engines/erector/erectorStateMachine.js");

    mockSelectChain.mockReturnValueOnce(buildSelectChain([{ erector_state: "LAUNCH_PERMITTED" }]));

    const result = await transition("bp-1", "user-1", "BLUEPRINT_ACTIVE", "blueprint_activation");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("launch-contract enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
  });

  it("permits onboarding blueprints without a launch contract", async () => {
    const { enforceLaunchContract } = await import("../../../engines/erector/LaunchContractEnforcer.js");

    mockSelectChain
      .mockReturnValueOnce(
        buildSelectChain([
          {
            blueprint_source: "onboarding",
            erector_intake_session_id: null,
            erector_validation_id: null,
          },
        ]),
      )
      .mockReturnValueOnce(buildSelectChain([]));

    const result = await enforceLaunchContract("bp-1", "user-1");
    expect(result.permitted).toBe(true);
    expect(result.contract_id).toBeNull();
  });

  it("blocks Erector blueprints without an active contract", async () => {
    const { enforceLaunchContract } = await import("../../../engines/erector/LaunchContractEnforcer.js");

    mockSelectChain
      .mockReturnValueOnce(
        buildSelectChain([
          {
            blueprint_source: "erector_authenticated",
            erector_intake_session_id: "sess-1",
            erector_validation_id: "vr-1",
          },
        ]),
      )
      .mockReturnValueOnce(buildSelectChain([]));

    const result = await enforceLaunchContract("bp-1", "user-1");
    expect(result.permitted).toBe(false);
    expect(result.reason).toBe("NO_LAUNCH_CONTRACT");
  });

  it("permits when contract is PERMITTED and state is LAUNCH_PERMITTED", async () => {
    const { enforceLaunchContract } = await import("../../../engines/erector/LaunchContractEnforcer.js");

    mockSelectChain
      .mockReturnValueOnce(
        buildSelectChain([
          {
            blueprint_source: "erector_authenticated",
            erector_intake_session_id: "sess-1",
            erector_validation_id: "vr-1",
          },
        ]),
      )
      .mockReturnValueOnce(
        buildSelectChain([
          {
            id: "contract-1",
            launch_permission: "PERMITTED",
          },
        ]),
      )
      .mockReturnValueOnce(buildSelectChain([{ erector_state: "LAUNCH_PERMITTED" }]))
      .mockReturnValueOnce(buildSelectChain([]));

    const result = await enforceLaunchContract("bp-1", "user-1");
    expect(result.permitted).toBe(true);
    expect(result.contract_id).toBe("contract-1");
  });
});
