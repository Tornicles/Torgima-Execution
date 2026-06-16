/**
 * Post-build chain alignment — verifies B-schema through B9 links in code.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");
const readRepo = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTsx(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("Post-build chain — schema addendum → B9", () => {
  it("migration 0041 defines all 7 Erector tables and user/blueprint columns", () => {
    const sql = readRepo("migrations/0041_erector_schema_addendum.sql");
    for (const table of [
      "erector_free_validations",
      "erector_paid_validations",
      "erector_intake_sessions",
      "handoff_tokens",
      "simulation_results",
      "goal_intelligence",
      "prediction_log",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("dashboard_mode");
    expect(sql).toContain("erector_tier");
    expect(sql).toContain("blueprint_source");
  });
});

describe("Post-build chain — B1 language map → Erector UI", () => {
  const languageMap = readRepo("artifacts/torgima/src/lib/language-map.ts");
  const erectorComponents = [
    "artifacts/torgima/src/components/erector/FreeIntakeForm.tsx",
    "artifacts/torgima/src/components/erector/FreeValidationReport.tsx",
    "artifacts/torgima/src/components/erector/UpgradeWall.tsx",
    "artifacts/torgima/src/components/erector/IntakeWizard.tsx",
  ];

  it("language-map exports all required label maps", () => {
    expect(languageMap).toContain("CONDITION_LABELS");
    expect(languageMap).toContain("SIGNAL_LABELS");
    expect(languageMap).toContain("BLUEPRINT_LABELS");
    expect(languageMap).toContain("TIER_LABELS");
    expect(languageMap).toContain("ERECTOR_LABELS");
  });

  it.each(erectorComponents)("%s imports language-map", (rel) => {
    expect(readRepo(rel)).toMatch(/language-map/);
  });
});

describe("Post-build chain — B2 dashboard mode", () => {
  it("state route branches on dashboard_mode via DashboardService", () => {
    const state = readRepo("artifacts/api-server/src/routes/state.ts");
    expect(state).toContain("getLimitedDashboardStateIfNeeded");
    expect(state).toContain("getDashboardState");
  });

  it("blueprint activation sets dashboard_mode full (Erector + direct)", () => {
    const feed = readRepo("artifacts/api-server/src/services/erector/blueprint-feed-service.ts");
    const engine = readRepo("artifacts/api-server/src/engines/blueprint/BlueprintEngine.ts");
    expect(feed).toMatch(/dashboard_mode.*full/);
    expect(engine).toMatch(/dashboard_mode.*full/);
  });
});

describe("Post-build chain — B3 Bhudhi contracts → B4 routes", () => {
  it("registers erector.free and erector.paid validate contracts", () => {
    const reg = readRepo("artifacts/api-server/src/bhudhi/registerErectorValidationPrompts.ts");
    expect(reg).toContain("erector.free.validate.v1");
    expect(reg).toContain("erector.paid.validate.v1");
    expect(reg).toContain("ERECTOR_FREE_VALIDATION");
  });

  it("free route uses ERECTOR_FREE_VALIDATION trigger via router", () => {
    const free = readRepo("artifacts/api-server/src/routes/erector/free.ts");
    expect(free).toContain("ERECTOR_FREE_VALIDATION");
    expect(free).toContain("routeBhudhiRequest");
    expect(free).not.toMatch(/anthropic|@anthropic-ai/);
  });
});

describe("Post-build chain — B4b blueprint feed → execution loop", () => {
  const feed = readRepo("artifacts/api-server/src/services/erector/blueprint-feed-service.ts");

  it("calls existing BlueprintEngine instead of duplicating creation", () => {
    expect(feed).toContain("BlueprintEngine");
    expect(feed).toContain("activateBlueprint");
  });

  it("performs all post-activation writes", () => {
    expect(feed).toMatch(/dashboard_mode.*full/);
    expect(feed).toMatch(/erector_tier.*authenticated/);
    expect(feed).toContain("blueprint_created: true");
    expect(feed).toContain('blueprint_source: "erector_authenticated"');
    expect(feed).toMatch(/status.*completed/);
  });
});

describe("Post-build chain — B4c handoff", () => {
  const handoff = readRepo("artifacts/api-server/src/services/handoff-service.ts");

  it("hashes tokens and enforces expiry + one-time use", () => {
    expect(handoff).toMatch(/hash|token_hash/i);
    expect(handoff).toMatch(/expires_at|expired/i);
    expect(handoff).toMatch(/consumed/i);
  });

  it("UpgradeWall creates handoff before redirect", () => {
    const wall = readRepo("artifacts/torgima/src/components/erector/UpgradeWall.tsx");
    expect(wall).toContain("createHandoffToken");
    expect(wall).toContain("handoff-client");
  });
});

describe("Post-build chain — B5B6B7 tier enforcement", () => {
  it("Control Engine applies tier-rules", () => {
    const control = readRepo("artifacts/api-server/src/engines/control/ControlEngine.ts");
    expect(control).toContain("tier-rules");
    expect(control).toContain("is_current: false");
  });

  it("Task Generation reads knowledge_injection_level", () => {
    const taskGen = readRepo("artifacts/api-server/src/engines/task-generation/TaskGenerationEngine.ts");
    expect(taskGen).toContain("knowledge_injection_level");
  });
});

describe("Post-build chain — B8 signal → condition events", () => {
  const signal = readRepo("artifacts/api-server/src/engines/signal/SignalCalculationEngine.ts");

  it("emits signal_updated and condition_evaluation_requested after calculate", () => {
    expect(signal).toContain("signal_updated");
    expect(signal).toContain("condition_evaluation_requested");
    expect(signal).toContain("emitSignalCalculationChainEvents");
  });

  it("assignConditionFromB8Matrix lists conditions in priority order", () => {
    const nothingness = signal.indexOf("nothingness");
    const danger = signal.indexOf('return "danger"');
    const urgency = signal.indexOf('return "urgency"');
    const stability = signal.indexOf('return "stability"');
    const power = signal.indexOf('return "power"');
    const affluence = signal.indexOf('return "affluence"');
    const powerChange = signal.indexOf('return "power_change"');
    expect(nothingness).toBeGreaterThan(0);
    expect(danger).toBeGreaterThan(nothingness);
    expect(urgency).toBeGreaterThan(danger);
    expect(stability).toBeGreaterThan(urgency);
    expect(power).toBeGreaterThan(stability);
    expect(affluence).toBeGreaterThan(power);
    expect(powerChange).toBeGreaterThan(affluence);
  });
});
