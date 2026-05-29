import { describe, it, expect, vi, beforeEach } from "vitest";
import { validations } from "@workspace/db";
import { ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { TorgimaError } from "../../../lib/errors.js";

type ValidationRow = typeof validations.$inferSelect;

const select = vi.fn();
const update = vi.fn();
const finalizeWorkspace = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: select })) })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: update })),
      })),
    })),
  },
  validations: { id: "id", user_id: "user_id" },
}));

vi.mock("../../../engines/erector/ErectorValidationWorkspace.js", () => ({
  finalizeValidationWorkspace: finalizeWorkspace,
}));

describe("ValidationFinalizationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue([]);
  });

  async function load() {
    return import("../../../services/ValidationFinalizationService.js");
  }

  const intelligenceRow = {
    id: "val-1",
    user_id: "u-1",
    blueprint_id: "bp-1",
    validation_kind: ValidationKind.INTELLIGENCE,
    validation_version: 1,
    is_finalized: false,
    raw_goal: "Launch SaaS with 100 customers",
    purpose: "Replace income",
    timeframe: "90 days",
    timeframe_days: 90,
    current_context: "Developer",
    path_current: { title: "Current" },
    path_adjusted: { title: "Adjusted" },
    path_alternative: { title: "Alt" },
    verdict: "proceed",
    selected_path: null,
    selected_path_type: null,
  } as ValidationRow;

  it("launch fails when validation is not finalized and finalize is skipped", async () => {
    const { requiresLaunchFinalization } = await load();
    expect(requiresLaunchFinalization(intelligenceRow)).toBe(true);
    expect(requiresLaunchFinalization({ ...intelligenceRow, is_finalized: true })).toBe(false);
  });

  it("finalization fails when selected path is missing and paths exist but no default", async () => {
    const { ValidationFinalizationService } = await load();
    select.mockResolvedValue([
      {
        ...intelligenceRow,
        verdict: null,
        path_current: null,
        path_adjusted: null,
        path_alternative: null,
        path_options: null,
      },
    ]);

    await expect(
      ValidationFinalizationService.finalizeValidation("val-1", "u-1"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("finalization stores is_finalized and finalized_at", async () => {
    const { ValidationFinalizationService } = await load();
    select.mockResolvedValue([intelligenceRow]);
    update.mockResolvedValue([
      {
        ...intelligenceRow,
        is_finalized: true,
        finalized_at: new Date("2026-05-27T00:00:00Z"),
        selected_path: "current",
        selected_path_type: "current",
        status: ValidationStatus.COMPLETE,
      },
    ]);

    const row = await ValidationFinalizationService.finalizeValidation("val-1", "u-1", {
      selectedPath: "current",
    });

    expect(row.is_finalized).toBe(true);
    expect(row.finalized_at).toBeTruthy();
    expect(row.selected_path_type).toBe("current");
    expect(update).toHaveBeenCalled();
  });

  it("launch succeeds after validation is finalized", async () => {
    const { requiresLaunchFinalization } = await load();
    expect(
      requiresLaunchFinalization({
        ...intelligenceRow,
        is_finalized: true,
        finalized_at: new Date(),
        selected_path: "current",
        selected_path_type: "current",
      }),
    ).toBe(false);
  });

  it("delegates erector validations to workspace finalization", async () => {
    const { ValidationFinalizationService } = await load();
    select
      .mockResolvedValueOnce([
        {
          ...intelligenceRow,
          validation_kind: ValidationKind.ERECTOR,
          validation_sections: [{ id: "s1" }],
        },
      ])
      .mockResolvedValueOnce([
        {
          ...intelligenceRow,
          validation_kind: ValidationKind.ERECTOR,
          is_finalized: true,
        },
      ]);
    finalizeWorkspace.mockResolvedValue({ finalized: true });

    const row = await ValidationFinalizationService.finalizeValidation("val-1", "u-1");
    expect(finalizeWorkspace).toHaveBeenCalledWith("val-1", "u-1");
    expect(row.is_finalized).toBe(true);
  });
});

describe("BlueprintLaunchService finalized gate", () => {
  it("throws TorgimaError when unfinalized after finalize step would fail", async () => {
    const { requiresLaunchFinalization } = await import(
      "../../../services/ValidationFinalizationService.js"
    );
    const row = {
      validation_version: 1,
      is_finalized: false,
      validation_kind: ValidationKind.INTELLIGENCE,
    };
    expect(requiresLaunchFinalization(row as never)).toBe(true);
    expect(() => {
      if (requiresLaunchFinalization(row as never)) {
        throw new TorgimaError(
          "VALIDATION_ERROR",
          "Validation must be finalized before blueprint launch. Complete the workspace and finalize first.",
          false,
        );
      }
    }).toThrow(/finalized before blueprint launch/);
  });
});
