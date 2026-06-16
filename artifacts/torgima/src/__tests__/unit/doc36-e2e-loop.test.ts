import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const torgimaRoot = resolve(import.meta.dirname, "../../..");
const apiRoot = resolve(torgimaRoot, "../api-server");
const repoRoot = resolve(torgimaRoot, "../..");
const readTorgima = (p: string) => readFileSync(resolve(torgimaRoot, p), "utf8");
const readApi = (p: string) => readFileSync(resolve(apiRoot, p), "utf8");
const readRepo = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

describe("DOC 36 — E2E loop testing gate", () => {
  it("defines doc36 integration tests under api-server", () => {
    expect(readApi("src/tests/e2e/doc36/loop.test.ts")).toContain(
      "completes full execution loop in under 10 seconds",
    );
    const scenarios = readApi("src/tests/e2e/doc36/scenarios.integration.test.ts");
    expect(scenarios).toContain("Loop scenarios (spec table)");
    expect(scenarios).toContain("gaming detection triggers interrogation");
    expect(scenarios).toContain("inactivity detection after 25 hours");
    expect(scenarios).toContain("false progress detected on wrong work");
    expect(scenarios).toContain("dependency blocks task publication");
    expect(scenarios).toContain("identity advances after consistent execution");
    expect(scenarios).toContain("reward blocked by false progress flag");
    expect(readApi("src/tests/e2e/doc36/full-loop.integration.test.ts")).toContain("runDoc36FullLoop");
    expect(readApi("src/tests/helpers/doc36-reset.ts")).toContain("resetDoc36TestUser");
    expect(readApi("src/tests/helpers/doc36-event-wait.ts")).toContain("waitForEvent");
  });

  it("e2e setup package verifies erector schema", () => {
    expect(readRepo("packages/test/setup/e2e.setup.ts")).toContain("verifyErectorSchema");
    expect(readRepo("packages/test/setup/e2e.setup.ts")).toContain("setupE2eEnvironment");
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

  it("full loop enforces 10s budget constant", () => {
    expect(readApi("src/tests/helpers/doc36-constants.ts")).toContain("DOC36_LOOP_BUDGET_MS");
    expect(readApi("src/tests/helpers/doc36-constants.ts")).toContain("10_000");
    expect(readApi("src/tests/helpers/doc36-constants.ts")).toContain("DOC36_TIMING");
  });

  it("database integrity checks health logs and dead letters", () => {
    expect(readApi("src/tests/e2e/doc36/db-integrity.integration.test.ts")).toContain(
      "criticalHealthLogs",
    );
    expect(readApi("src/tests/helpers/doc36-loop-runner.ts")).toContain("unreviewedDeadLetters");
  });
});

describe("feedback-screen", () => {
  it("doc36 runner references loop and scenario suites", () => {
    expect(readRepo("scripts/run-doc36-e2e.mjs")).toContain("src/tests/e2e/doc36");
  });
});
