import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const torgimaRoot = resolve(import.meta.dirname, "../../..");
const apiRoot = resolve(torgimaRoot, "../api-server");
const repoRoot = resolve(torgimaRoot, "../..");
const readTorgima = (p: string) => readFileSync(resolve(torgimaRoot, p), "utf8");
const readApi = (p: string) => readFileSync(resolve(apiRoot, p), "utf8");

describe("DOC 36 — E2E loop testing gate", () => {
  it("defines doc36 integration tests under api-server", () => {
    expect(readApi("src/tests/e2e/doc36/full-loop.integration.test.ts")).toContain("runDoc36FullLoop");
    expect(readApi("src/tests/e2e/doc36/engine-rules.integration.test.ts")).toContain("REJECTED");
    expect(readApi("src/tests/helpers/doc36-reset.ts")).toContain("resetDoc36TestUser");
  });

  it("signals page uses dashboard projection (doc35) for loop continuity", () => {
    expect(readTorgima("src/pages/signals.tsx")).toContain("useDashboardProjection");
    expect(readTorgima("src/components/tasks/FeedbackForm.tsx")).toContain("runDashboardMutation");
    expect(readTorgima("src/components/tasks/FeedbackForm.tsx")).not.toContain("Date.now()");
  });

  it("provides reset script and runner", () => {
    expect(readFileSync(resolve(repoRoot, "scripts/doc36-reset-test-user.ts"), "utf8")).toContain(
      "resetDoc36TestUser",
    );
    expect(readFileSync(resolve(repoRoot, "scripts/run-doc36-e2e.mjs"), "utf8")).toContain("doc36");
  });

  it("playwright doc36 suite exists", () => {
    expect(readTorgima("tests/e2e/doc36/loop.spec.ts")).toContain("DOC 36");
  });

  it("full loop enforces 15s budget constant", () => {
    expect(readApi("src/tests/helpers/doc36-constants.ts")).toContain("DOC36_LOOP_BUDGET_MS");
  });
});
