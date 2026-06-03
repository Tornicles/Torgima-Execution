import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const torgimaRoot = resolve(import.meta.dirname, "../../..");
const apiRoot = resolve(torgimaRoot, "../api-server");
const repoRoot = resolve(torgimaRoot, "../..");
const readTorgima = (p: string) => readFileSync(resolve(torgimaRoot, p), "utf8");
const readApi = (p: string) => readFileSync(resolve(apiRoot, p), "utf8");

const DOC37_SUITES = [
  "errors.api-contract.test.ts",
  "errors.validation.test.ts",
  "errors.state-integrity.test.ts",
  "errors.events.test.ts",
  "errors.bhudhi-contract.test.ts",
  "errors.security.test.ts",
] as const;

describe("DOC 37 — Error handling & edge case gate", () => {
  it("defines seven failure taxonomy classes", () => {
    const tax = readApi("src/lib/failure-taxonomy.ts");
    expect(tax).toContain("DOC37_FAILURE_CLASSES");
    expect(tax.match(/validation_error/g)?.length).toBeGreaterThan(0);
    expect(tax).toContain("state_integrity_error");
  });

  it("api-server doc37 test suites exist", () => {
    for (const file of DOC37_SUITES) {
      expect(readApi(`src/tests/e2e/doc37/${file}`)).toContain("DOC 37");
    }
  });

  it("failure taxonomy and feedback payload limit wired", () => {
    expect(readApi("src/lib/failure-taxonomy.ts")).toContain("classifyFailureCode");
    expect(readApi("src/lib/feedback-payload-limit.ts")).toContain("FEEDBACK_PAYLOAD_MAX_BYTES");
    expect(readApi("src/lib/utils.ts")).toContain("classifyFailureCode");
    expect(readApi("src/routes/orders.ts")).toContain("assertFeedbackPayloadWithinLimit");
  });

  it("activateBlueprint missing tier returns ACTIVATION_FAILED", () => {
    expect(readApi("src/engines/blueprint/BlueprintRuleEngine.ts")).toContain("ACTIVATION_FAILED");
  });

  it("Bhudhi log fail-open for non-critical triggers", () => {
    const core = readApi("src/bhudhi/BhudhiCore.ts");
    expect(core).toContain("abort: false");
    expect(core).not.toMatch(/GOAL_STRUCTURING[\s\S]{0,80}CRITICAL_BHUDHI_LOG_TRIGGERS/);
  });

  it("frontend resilience: draft, offline, focus refetch", () => {
    expect(readTorgima("src/lib/feedback-draft.ts")).toContain("sessionStorage");
    expect(readTorgima("src/hooks/useNetworkResilience.ts")).toContain("offline");
    expect(readTorgima("src/hooks/useDashboardProjection.ts")).toContain("refetchOnWindowFocus");
    expect(readTorgima("src/components/tasks/FeedbackForm.tsx")).toContain("saveFeedbackDraft");
    expect(readTorgima("src/components/dashboard/NoTaskState.tsx")).toContain("noTaskYet");
    expect(readTorgima("src/components/signals/ExplainStateDrawer.tsx")).toContain(
      "explainUnavailable",
    );
  });

  it("playwright frontend-resilience suite exists", () => {
    expect(readTorgima("tests/e2e/doc37/errors.frontend-resilience.spec.ts")).toContain("DOC 37");
  });

  it("runner script registered", () => {
    expect(readFileSync(resolve(repoRoot, "scripts/run-doc37-e2e.mjs"), "utf8")).toContain("doc37");
  });
});
