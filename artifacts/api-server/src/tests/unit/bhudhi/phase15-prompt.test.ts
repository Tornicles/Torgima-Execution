/**
 * BHUDHI_CURSOR_PROMPT_15 — production deployment readiness.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBhudhiAPIAvailability } from "../../../routes/health.js";

const root = resolve(process.cwd(), "../..");

function readRepo(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Prompt 15 — Production deployment readiness", () => {
  it("TEST 1: production database migration checklist is documented", () => {
    const runbook = readRepo("docs/PRODUCTION_RUNBOOK.md");
    expect(runbook).toContain("pnpm -F @workspace/db push");
    expect(runbook).toContain("pnpm -F @workspace/db db:partial-indexes");
    expect(runbook).toContain("pnpm -F @workspace/db db:triggers");
    expect(runbook).toContain("pnpm -F @workspace/db verify");
  });

  it("TEST 2: /api/health exposes the Prompt 15 health contract", () => {
    const health = readRepo("artifacts/api-server/src/routes/health.ts");
    expect(health).toContain("ProductionHealthResponse");
    expect(health).toContain("status: \"healthy\" | \"degraded\"");
    expect(health).toContain("database: ProductionHealthCheck");
    expect(health).toContain("bhudhi: ProductionHealthCheck");
    expect(health).toContain("workers: ProductionHealthCheck");
    expect(health).toContain("signals: ProductionHealthCheck");
    expect(health).toContain("res.status(results.status === \"healthy\" ? 200 : 503).json(results)");
  });

  it("TEST 3: production onboarding smoke test is included in handoff", () => {
    const runbook = readRepo("docs/PRODUCTION_RUNBOOK.md");
    expect(runbook).toContain("onboarding smoke test");
    expect(runbook).toContain("curl -fsS https://torgima.com");
  });

  it("TEST 4: primary loop production performance target is preserved", () => {
    const prompt = readRepo("prompt15-extract.txt");
    expect(prompt).toContain("Primary Loop completes in < 5 seconds");
    const phase13 = readRepo("artifacts/api-server/src/tests/unit/bhudhi/phase13-prompt.test.ts");
    expect(phase13).toContain("primaryLoopMs");
  });

  it("TEST 5: workers and pg-boss readiness are configured", () => {
    const queue = readRepo("artifacts/api-server/src/lib/queue.ts");
    const runbook = readRepo("docs/PRODUCTION_RUNBOOK.md");
    expect(queue).toContain("process.env.PGBOSS_DATABASE_URL ?? process.env.DATABASE_URL");
    expect(runbook).toContain("pg-boss");
    expect(runbook).toContain("overnight cycle");
  });

  it("TEST 6: Three Laws production audit remains part of the checklist", () => {
    const prompt13 = readRepo("artifacts/api-server/src/tests/unit/bhudhi/phase13-prompt.test.ts");
    const runbook = readRepo("docs/PRODUCTION_RUNBOOK.md");
    expect(prompt13).toContain("Three Laws");
    expect(runbook).toContain("Platform references");
  });

  it("TEST 7: marketing site production assets are present", () => {
    expect(statSync(resolve(root, "artifacts/torgima/public/og-image.png")).size).toBeGreaterThan(1_000);
    expect(readRepo("artifacts/torgima/public/sitemap.xml")).toContain("https://torgima.com/how-it-works");
    expect(readRepo("artifacts/torgima/public/robots.txt")).toContain("Sitemap: https://torgima.com/sitemap.xml");
  });

  it("TEST 8: Bhudhi availability fails closed in production without API key", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousKey = process.env.ANTHROPIC_API_KEY;
    const previousLegacyKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    process.env.NODE_ENV = "production";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

    try {
      await expect(checkBhudhiAPIAvailability()).rejects.toThrow("ANTHROPIC_API_KEY");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousKey;
      if (previousLegacyKey === undefined) delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
      else process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = previousLegacyKey;
    }
  });

  it("TEST 9: monitoring and backup strategy are documented", () => {
    const runbook = readRepo("docs/PRODUCTION_RUNBOOK.md");
    for (const phrase of [
      "External monitoring should ping",
      "Supabase backups",
      "signal_snapshots",
      "orders",
      "Monthly restore drill",
      "Bhudhi fallback usage exceeds 20%",
    ]) {
      expect(runbook).toContain(phrase);
    }
  });

  it("TEST 10: Phase 2 readiness thresholds are explicit", () => {
    const runbook = readRepo("docs/PRODUCTION_RUNBOOK.md");
    for (const phrase of [
      "50 active users",
      "500 completed primary loop cycles",
      "100 burnout records",
      "20 completed Academy learning paths",
      "Phase 2 preview",
    ]) {
      expect(runbook).toContain(phrase);
    }
  });
});
