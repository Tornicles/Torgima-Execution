import { describe, it, expect } from "vitest";
import { resolveDefaultSelectedPath } from "../../../lib/validationPathSelection.js";

describe("Blueprint path_selection transition", () => {
  it("defaults path to adjusted when verdict is adjust", () => {
    expect(resolveDefaultSelectedPath("adjust")).toBe("adjusted");
  });

  it("defaults path to alternative when verdict is pivot", () => {
    expect(resolveDefaultSelectedPath("pivot")).toBe("alternative");
  });

  it("registers blueprint PATCH select-path route", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../routes/blueprints.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain('router.patch("/blueprints/:id/select-path"');
  });
});
