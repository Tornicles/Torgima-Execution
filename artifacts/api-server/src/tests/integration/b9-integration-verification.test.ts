/**
 * DOC B9 — B-document integration verification (static + schema contract).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  erectorFreeValidations,
  erectorPaidValidations,
  erectorIntakeSessions,
  handoffTokens,
  simulationResults,
  goalIntelligence,
  predictionLog,
  users,
  blueprints,
} from "@workspace/db";

const repoRoot = resolve(process.cwd(), "../..");
const readRepo = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

const B9_TABLES = [
  "erector_free_validations",
  "erector_paid_validations",
  "erector_intake_sessions",
  "handoff_tokens",
  "simulation_results",
  "goal_intelligence",
  "prediction_log",
] as const;

describe("DOC B9 — database schema contracts", () => {
  it("defines all 7 new Erector / Ultimate tables in Drizzle schema", () => {
    const tables = {
      erector_free_validations: erectorFreeValidations,
      erector_paid_validations: erectorPaidValidations,
      erector_intake_sessions: erectorIntakeSessions,
      handoff_tokens: handoffTokens,
      simulation_results: simulationResults,
      goal_intelligence: goalIntelligence,
      prediction_log: predictionLog,
    };
    for (const name of B9_TABLES) {
      expect(tables[name], `missing table ${name}`).toBeDefined();
    }
  });

  it("migration 0041 creates all 7 new tables", () => {
    const sql = readRepo("migrations/0041_erector_schema_addendum.sql");
    for (const name of B9_TABLES) {
      expect(sql).toContain(name);
    }
  });

  it("users table has dashboard_mode and erector_tier", () => {
    expect(users.dashboard_mode).toBeDefined();
    expect(users.erector_tier).toBeDefined();
    const migration = readRepo("migrations/0041_erector_schema_addendum.sql");
    expect(migration).toContain("dashboard_mode");
    expect(migration).toContain("erector_tier");
    expect(migration).toMatch(/dashboard_mode.*default.*limited/i);
  });

  it("blueprints table has erector handoff columns", () => {
    expect(blueprints.erector_validation_id).toBeDefined();
    expect(blueprints.erector_intake_session_id).toBeDefined();
    expect(blueprints.blueprint_source).toBeDefined();
  });
});

describe("DOC B9 — API route registration", () => {
  const routesIndex = readRepo("artifacts/api-server/src/routes/index.ts");

  const requiredMounts = [
    'router.use("/api/erector", erectorFreeRouter)',
    'router.use("/api/erector", erectorIntakeRouter)',
    'router.use("/api/erector", erectorPaidRouter)',
    'router.use("/api/handoff", handoffRouter)',
    'router.post("/api/billing/upgrade"',
  ];

  it.each(requiredMounts)("registers %s", (snippet) => {
    expect(routesIndex).toContain(snippet);
  });

  it("erector free route exposes POST /free/validate", () => {
    const free = readRepo("artifacts/api-server/src/routes/erector/free.ts");
    expect(free).toContain('router.post("/free/validate"');
    expect(free).toContain('router.get("/free/report/');
  });

  it("handoff routes require auth on consume", () => {
    const handoff = readRepo("artifacts/api-server/src/routes/handoff.ts");
    expect(handoff).toContain('router.post("/consume"');
    expect(handoff).toContain("USER_SESSION");
  });

  it("intake session route requires auth", () => {
    const intake = readRepo("artifacts/api-server/src/routes/erector/intake.ts");
    expect(intake).toContain('router.post("/intake/session"');
    expect(intake).toContain("USER_SESSION");
  });
});

describe("DOC B9 — engine invariants (DOC 01-09)", () => {
  it("signal snapshots are written from SignalCalculationEngine", () => {
    const signalEngine = readRepo("artifacts/api-server/src/engines/signal/SignalCalculationEngine.ts");
    expect(signalEngine).toContain("insert(signalSnapshots)");
    expect(signalEngine).not.toMatch(/manual.*signal/i);
  });

  it("enforcement packages mark prior rows non-current before insert", () => {
    const control = readRepo("artifacts/api-server/src/engines/control/ControlEngine.ts");
    expect(control).toContain("is_current: false");
    expect(control).toContain("insert(enforcementPackages)");
  });

  it("blueprint activation emits blueprint_activated event type", () => {
    const events = readRepo("artifacts/api-server/src/types/events.ts");
    expect(events).toContain('"blueprint_activated"');
    const blueprint = readRepo("artifacts/api-server/src/engines/blueprint/BlueprintEngine.ts");
    expect(blueprint).toMatch(/blueprint_activated|EVENT_TYPES/);
  });

  it("continuous task guarantee engine exists and is exported", () => {
    const guarantee = readRepo(
      "artifacts/api-server/src/engines/task-guarantee/ContinuousTaskGuaranteeEngine.ts",
    );
    expect(guarantee).toMatch(/ensureActiveOrder|task.*0/i);
    const loopIndex = readRepo("artifacts/api-server/src/engines/execution-loop/index.ts");
    expect(loopIndex).toContain("ContinuousTaskGuaranteeEngine");
  });

  it("feedback processing enforces proof when order.proof_required", () => {
    const feedback = readRepo("artifacts/api-server/src/engines/feedback/processFeedbackLegacy.ts");
    expect(feedback).toContain("proof_required");
    expect(feedback).toMatch(/proofRequired|proof_required/);
  });
});

function walkTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkTsxFiles(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("DOC B9 — language map adoption", () => {
  const languageMap = readRepo("artifacts/torgima/src/lib/language-map.ts");

  it("language-map exports required label constants", () => {
    expect(languageMap).toContain("CONDITION_LABELS");
    expect(languageMap).toContain("SIGNAL_LABELS");
    expect(languageMap).toContain("BLUEPRINT_LABELS");
    expect(languageMap).toContain("TIER_LABELS");
    expect(languageMap).toContain("getConditionLabel");
  });

  it("at least 3 frontend files import language-map", () => {
    const componentsDir = resolve(repoRoot, "artifacts/torgima/src");
    const files = walkTsxFiles(componentsDir);
    const adopters = files.filter((f) => readFileSync(f, "utf8").includes("language-map"));
    expect(adopters.length).toBeGreaterThanOrEqual(3);
  });

  it("components do not hardcode internal condition display labels", () => {
    const componentsDir = resolve(repoRoot, "artifacts/torgima/src/components");
    const files = walkTsxFiles(componentsDir);
    const banned = [
      /["']Nothingness["']/,
      /["']Danger["']/,
      /["']Affluence["']/,
      /["']Urgency["']/,
      /["']Stability["']/,
      /["']Power["']/,
    ];
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(content)) {
          violations.push(`${file}: ${pattern}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
