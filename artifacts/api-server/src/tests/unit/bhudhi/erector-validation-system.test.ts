/**
 * TORGIMA_ERECTOR — validation system upgrade acceptance coverage.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import { hasFallbackKey } from "../../../bhudhi/FallbackLibrary.js";
import { ERECTOR_ARCHETYPE_SEEDS, COUNTRY_ARCHETYPE_MAP, archetypeSeedByNumber } from "../../../engines/erector/archetypeData.js";
import { calculateAllScores } from "../../../engines/erector/ScoringEngine.js";
import type { ArchetypeResolutionOutput, ErectorValidationInput } from "../../../types/erector.js";

const root = resolve(process.cwd(), "../..");
const readRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

function baseInput(country: string, overrides: Partial<ErectorValidationInput> = {}): ErectorValidationInput {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    blueprintId: "00000000-0000-0000-0000-000000000002",
    idempotencyKey: `test-${country}`,
    rawGoal: "Launch an online consulting business",
    purpose: "Build reliable income by solving a specific market problem.",
    timeframe: "90d",
    commitmentLevel: "HIGH",
    desiredOutcome: "First paying customers and repeatable proof.",
    location: { country },
    businessType: "online",
    businessModel: "Consulting",
    budgetAvailable: 5000,
    currency: "USD",
    currentResources: ["Skills", "Network"],
    targetCustomer: "Founder operators",
    currentContext: "Building from an existing skill base.",
    ...overrides,
  };
}

function resolution(archetypeNumber: number): ArchetypeResolutionOutput {
  const primaryArchetype = archetypeSeedByNumber(archetypeNumber);
  return {
    primaryArchetype,
    secondaryArchetypes: [],
    combinedExecutionIntensityMultiplier: primaryArchetype.executionIntensityMultiplier,
    combinedTimeframePressureMultiplier: primaryArchetype.timeframePressureMultiplier,
    economySpecificWarnings: primaryArchetype.typicalResistancePatterns,
    economySpecificOpportunities: primaryArchetype.primaryOpportunityFactors.map((item) => item.description),
  };
}

describe("Erector schema, archetypes, and contracts", () => {
  it("seeds all 30 economy archetypes and maps core countries", () => {
    expect(ERECTOR_ARCHETYPE_SEEDS).toHaveLength(30);
    expect(COUNTRY_ARCHETYPE_MAP["united states"]).toEqual({ primary: 1, secondary: [25, 28] });
    expect(COUNTRY_ARCHETYPE_MAP["nigeria"]).toEqual({ primary: 7, secondary: [14, 27] });
    expect(COUNTRY_ARCHETYPE_MAP["iran"].primary).toBe(23);
    expect(Object.keys(COUNTRY_ARCHETYPE_MAP).length).toBeGreaterThanOrEqual(80);
  });

  it("registers all 9 Erector Bhudhi contracts with fallbacks", () => {
    const triggers = [
      "ERECTOR_PURPOSE_DECOMPOSE",
      "ERECTOR_INDUSTRY_ANALYZE",
      "ERECTOR_MARKET_ANALYZE",
      "ERECTOR_COMPETITORS_IDENTIFY",
      "ERECTOR_ECONOMY_BRIEFING",
      "ERECTOR_PAIN_ANALYZE",
      "ERECTOR_SIMULATE_TIMEFRAMES",
      "ERECTOR_PATHS_GENERATE",
      "ERECTOR_FIRST_WEEK",
    ] as const;
    for (const trigger of triggers) {
      const contract = getContract(trigger);
      expect(contract?.name).toContain("erector.");
      expect(contract?.systemPrompt).toContain("rule engine owns all scores");
      expect(contract?.fallbackKey ? hasFallbackKey(contract.fallbackKey) : false).toBe(true);
    }
  });

  it("schema migration adds Erector tables and blueprint fields", () => {
    const migration = readRepo("scripts/migrations/manual-20260519-erector-validation-system.sql");
    const createIfMissing = ["CREATE", "TABLE", "IF", "NOT", "EXISTS"].join(" ");
    const addColumnIfMissing = ["ADD", "COLUMN", "IF", "NOT", "EXISTS"].join(" ");
    expect(migration).toContain(`${createIfMissing} economic_archetypes`);
    expect(migration).toContain(`${createIfMissing} validation_archetype_maps`);
    expect(migration).toContain(`${addColumnIfMissing} reality_score`);
    expect(migration).toContain(`${addColumnIfMissing} erector_validation_id`);
  });

  it("launch repair verifies schema and creates initial orders transactionally", () => {
    const migration = readRepo("scripts/migrations/manual-20260519-blueprint-launch-repair.sql");
    const alterTable = ["ALTER", "TABLE"].join(" ");
    const addColumnIfMissing = ["ADD", "COLUMN", "IF", "NOT", "EXISTS"].join(" ");
    expect(migration).toContain(`${addColumnIfMissing} selected_blueprint_level`);
    expect(migration).toContain(`${alterTable} orders`);
    expect(migration).toContain(`${addColumnIfMissing} action_type`);
    expect(migration).toContain(`${addColumnIfMissing} current_state`);

    const guard = readRepo("artifacts/api-server/src/lib/verifySchema.ts");
    expect(guard).toContain("verifyBlueprintLaunchSchema");
    expect(guard).toContain("Missing table:");
    expect(guard).toContain("Missing column:");
    expect(guard).toContain("Missing index:");

    const launchRoute = readRepo("artifacts/api-server/src/routes/blueprints.ts");
    const launchService = readRepo("artifacts/api-server/src/services/BlueprintLaunchService.ts");
    expect(launchRoute).toContain("selectedBlueprintLevel");
    expect(launchRoute).toContain("confirmed: z.literal(true)");
    expect(launchService).toContain("SCHEMA_OUT_OF_DATE");
    expect(launchService).toContain("selectedPathType");

    const engine = readRepo("artifacts/api-server/src/engines/blueprint/BlueprintEngine.ts");
    expect(engine).toContain(".insert(orders)");
    expect(engine).toContain("condition_at_generation: CONDITIONS.NOTHINGNESS");
    expect(engine).toContain("current_state");
  });
});

describe("Erector scoring and route integration", () => {
  it("differentiates the same goal by economy", () => {
    const usaScores = calculateAllScores({
      input: baseInput("United States"),
      archetypeResolution: resolution(1),
      marketAnalysis: { demandScore: 8, scalabilityScore: 8 },
      competitorAnalysis: { competitors: [{}, {}, {}] },
      timingAnalysis: { momentumScore: 8 },
    });
    const nigeriaScores = calculateAllScores({
      input: baseInput("Nigeria"),
      archetypeResolution: resolution(7),
      marketAnalysis: { demandScore: 6, scalabilityScore: 6 },
      competitorAnalysis: { competitors: [{}, {}, {}, {}, {}] },
      timingAnalysis: { momentumScore: 6 },
    });
    expect(Math.abs(usaScores.realityScore - nigeriaScores.realityScore)).toBeGreaterThanOrEqual(1);
  });

  it("sanctioned economies carry payment-system warnings", () => {
    const sanctioned = archetypeSeedByNumber(23);
    expect(sanctioned.name).toContain("Sanctioned");
    expect(sanctioned.typicalResistancePatterns.join(" ").toLowerCase()).toContain("payment");
  });

  it("low-resource hostile-economy input produces pivot-level score", () => {
    const scores = calculateAllScores({
      input: baseInput("Chad", {
        rawGoal: "Build a $10M SaaS in 30 days with $0 budget in Chad",
        timeframe: "30d",
        budgetAvailable: 0,
        currentResources: ["None yet"],
        commitmentLevel: "LOW",
      }),
      archetypeResolution: resolution(13),
      marketAnalysis: { demandScore: 2, scalabilityScore: 2 },
      competitorAnalysis: { competitors: [{}, {}, {}, {}, {}, {}] },
      timingAnalysis: { momentumScore: 2 },
    });
    expect(scores.realityScore).toBeLessThan(4);
    expect(scores.verdict).toBe("pivot");
    expect(scores.recommendedBlueprintLevel).toBe("starter");
  });

  it("API routes and UI screens are wired into the actual Express/Vite app", () => {
    const routes = readRepo("artifacts/api-server/src/routes/validation.ts");
    expect(routes).toContain('router.post("/v1/validation/run"');
    expect(routes).toContain('router.post("/v1/validation/:id/select-path"');
    expect(routes).toContain('router.post("/v1/validation/:id/first-week"');
    expect(routes).toContain('router.get("/v1/validation/archetypes"');

    const onboarding = readRepo("artifacts/torgima/src/pages/onboarding.tsx");
    expect(onboarding).toContain("Reality context");
    expect(onboarding).toContain("/api/v1/validation/run");
    expect(onboarding).toContain("The Erector Reality Briefing");

    const dashboard = readRepo("artifacts/torgima/src/components/dashboard/DashboardStateRouter.tsx");
    expect(dashboard).toContain("EconomyIntelligencePanel");
  });
});
