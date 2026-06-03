import { describe, expect, it } from "vitest";
import { assertSelectionComplete } from "../../../engines/blueprint/BlueprintRuleEngine.js";
import { TorgimaError } from "../../../lib/errors.js";

describe("assertSelectionComplete", () => {
  it("lists missing fields in error message", () => {
    try {
      assertSelectionComplete({
        blueprintId: "bp-123",
        status: "path_selection",
        tier: null,
        mode: "individual",
        selectionConfirmedAt: null,
      });
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TorgimaError);
      const e = err as TorgimaError;
      expect(e.code).toBe("ACTIVATION_FAILED");
      expect(e.message).toContain("tier");
      expect(e.message).toContain("selection_confirmed_at");
      expect(e.message).toContain("bp-123");
      expect(e.message).toContain("path_selection");
    }
  });

  it("passes when tier, mode, and selection_confirmed_at are set", () => {
    expect(() =>
      assertSelectionComplete({
        blueprintId: "bp-1",
        status: "path_selection",
        tier: "growth",
        mode: "individual",
        selectionConfirmedAt: new Date(),
      }),
    ).not.toThrow();
  });
});
