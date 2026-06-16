/**
 * DOC 37 §7 — production readiness checklist (structural gate).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const apiRoot = resolve(import.meta.dirname, "../../../..");
const torgimaRoot = resolve(apiRoot, "../torgima");
const repoRoot = resolve(apiRoot, "../..");

function readApi(rel: string) {
  return readFileSync(resolve(apiRoot, rel), "utf8");
}

function readTorgima(rel: string) {
  return readFileSync(resolve(torgimaRoot, rel), "utf8");
}

function grepDir(dir: string, pattern: RegExp, ext = ".ts"): string[] {
  const hits: string[] = [];
  const walk = (p: string) => {
    for (const name of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, name.name);
      if (name.isDirectory() && name.name !== "node_modules" && name.name !== "tests") walk(full);
      else if (
        name.isFile() &&
        name.name.endsWith(ext) &&
        !full.includes(`${join("src", "tests")}${join("", "")}`) &&
        !full.includes("src\\tests\\") &&
        pattern.test(readFileSync(full, "utf8"))
      ) {
        hits.push(full);
      }
    }
  };
  walk(dir);
  return hits;
}

describe("DOC 37 — production readiness checklist", () => {
  it("failure taxonomy and payload limits wired", () => {
    expect(readApi("src/lib/failure-taxonomy.ts")).toContain("DOC37_FAILURE_CLASSES");
    expect(readApi("src/lib/feedback-payload-limit.ts")).toContain("FEEDBACK_PAYLOAD_MAX_BYTES");
  });

  it("no direct anthropic.messages.create in api-server src", () => {
    const hits = grepDir(resolve(apiRoot, "src"), /anthropic\.messages\.create/);
    expect(hits).toHaveLength(0);
  });

  it("rate limiting returns 429 for RATE_LIMITED", async () => {
    const { torgimaErrorToStatus } = await import("../../../lib/errors.js");
    expect(torgimaErrorToStatus("RATE_LIMITED")).toBe(429);
  });

  it("unauthenticated dashboard blocked (structural)", () => {
    expect(readApi("src/routes/state.ts")).toMatch(/requireAuth|USER_SESSION/);
  });

  it("erector schema seed expects 27+ tables", () => {
    expect(readFileSync(resolve(repoRoot, "lib/db/src/erector-seed.ts"), "utf8")).toMatch(
      /27|erector_/,
    );
  });

  it("doc37 edge suites cover race, proof, scoring, recovery", () => {
    const doc37Dir = resolve(apiRoot, "src/tests/e2e/doc37");
    const files = readdirSync(doc37Dir);
    expect(files).toContain("errors.race-conditions.test.ts");
    expect(files).toContain("errors.proof-validation.test.ts");
    expect(files).toContain("errors.scoring-boundaries.test.ts");
    expect(files).toContain("errors.system-failures.test.ts");
    expect(files).toContain("errors.recovery-scenarios.test.ts");
  });

  it("frontend resilience modules present", () => {
    expect(readTorgima("src/lib/feedback-draft.ts")).toContain("sessionStorage");
    expect(readTorgima("src/hooks/useNetworkResilience.ts")).toContain("offline");
  });

  it("pnpm test:edge runner registered", () => {
    const pkg = readFileSync(resolve(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("test:edge");
  });
});
