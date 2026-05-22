/**
 * Prompt 9 Erector — acceptance criteria items 21–41.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, validations, orders, bhudhiLogs, systemHealthLogs } from "@workspace/db";
import { integrationEnabled } from "../../helpers/db.js";
import {
  seedErectorFixture,
  cleanupErectorFixture,
  seedStuckValidationFixture,
  countArchetypesWithSubstance,
} from "../../fixtures/erector-fixtures.js";
import {
  erectorAc,
  formatErectorAcceptanceReport,
  type ErectorAcResult,
} from "../../acceptance/erector-acceptance-checklist.js";
import { ERECTOR_ARCHETYPE_SEEDS } from "../../../engines/erector/archetypeData.js";
import { resolveArchetype } from "../../../engines/erector/ArchetypeResolutionEngine.js";
import { buildDeterministicErectorPayload } from "../../../engines/erector/ErectorDeterministicPayload.js";
import { buildTimeSimulations } from "../../../engines/erector/PathEngine.js";
import { calculateAllScores } from "../../../engines/erector/ScoringEngine.js";
import { archetypeSeedByNumber } from "../../../engines/erector/archetypeData.js";
import type { ArchetypeResolutionOutput, ErectorValidationInput } from "../../../types/erector.js";
import { ValidationService } from "../../../services/ValidationService.js";
import { DashboardService } from "../../../services/DashboardService.js";
import { runIntegrityChecks } from "../../../services/SystemHealthService.js";
import { OrderStatus } from "@workspace/state-machine";
import { generate } from "../../../engines/task-generation/TaskGenerationEngine.js";
import { jsonFetch, startErectorTestServer, createSessionForUser } from "../../helpers/erector-http.js";

const run = integrationEnabled();
const repoRoot = resolve(process.cwd(), "../..");

function simDailyAverage(sim: { dailyTaskCount?: { average?: number; max?: number } | number }): number {
  const c = sim.dailyTaskCount;
  if (typeof c === "number") return c;
  return c?.average ?? c?.max ?? 0;
}

function baseInput(country: string): ErectorValidationInput {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    blueprintId: "00000000-0000-0000-0000-000000000002",
    idempotencyKey: `ac-${country}`,
    rawGoal: "Launch an online consulting business",
    purpose: "Build reliable income.",
    timeframe: "90d",
    commitmentLevel: "HIGH",
    desiredOutcome: "Paying clients.",
    location: { country },
    businessType: "online",
    businessModel: "Consulting",
    budgetAvailable: 5000,
    currency: "USD",
    currentResources: ["Skills"],
    targetCustomer: "Founders",
  };
}

function resolutionFromNumber(n: number): ArchetypeResolutionOutput {
  const primary = archetypeSeedByNumber(n);
  return {
    primaryArchetype: primary,
    secondaryArchetypes: [],
    combinedExecutionIntensityMultiplier: primary.executionIntensityMultiplier,
    combinedTimeframePressureMultiplier: primary.timeframePressureMultiplier,
    economySpecificWarnings: primary.typicalResistancePatterns,
    economySpecificOpportunities: primary.primaryOpportunityFactors.map((o) => o.description),
  };
}

describe("Erector acceptance criteria 21–41 (structural)", () => {
  const results: ErectorAcResult[] = [];

  afterAll(() => {
    console.log(formatErectorAcceptanceReport(results));
  });

  it("21 — 30 archetypes have substantive profiles", () => {
    const placeholders = ERECTOR_ARCHETYPE_SEEDS.filter(
      (a) => !a.name || a.name.length < 4 || a.countries.length === 0,
    );
    const pass = ERECTOR_ARCHETYPE_SEEDS.length === 30 && placeholders.length === 0;
    results.push(erectorAc(21, "30 archetypes substantive", pass));
    expect(ERECTOR_ARCHETYPE_SEEDS).toHaveLength(30);
  });

  it("25 — nine engine output fields are non-empty in deterministic payload", async () => {
    const archetype = await resolveArchetype("Nigeria", "Lagos");
    const outputs = buildDeterministicErectorPayload(baseInput("Nigeria"), archetype);
    const keys = [
      outputs.purposeDecomposition,
      outputs.industryIntelligence,
      outputs.marketAnalysis,
      outputs.competitorAnalysis,
      outputs.economyBriefing,
      outputs.customerPainAnalysis,
      outputs.executionDifficulty,
      outputs.timingAnalysis,
    ];
    const pass = keys.every((k) => k && Object.keys(k).length > 0);
    results.push(erectorAc(25, "9 engine outputs populated", pass));
    expect(pass).toBe(true);
  });

  it("27 — scoring engine does not require BhudhiLog", async () => {
    const archetype = await resolveArchetype("Germany", "Berlin");
    const outputs = buildDeterministicErectorPayload(baseInput("Germany"), archetype);
    const scores = calculateAllScores({
      input: baseInput("Germany"),
      archetypeResolution: archetype,
      marketAnalysis: outputs.marketAnalysis,
      competitorAnalysis: outputs.competitorAnalysis,
      timingAnalysis: outputs.timingAnalysis,
    });
    const pass = scores.realityScore > 0 && scores.verdict.length > 0;
    results.push(erectorAc(27, "deterministic scoring", pass));
    expect(scores.realityScore).toBeGreaterThan(0);
  });

  it("32 — 90d simulation intensity exceeds 1yr", async () => {
    const archetype = await resolveArchetype("United States", "Austin");
    const outputs = buildDeterministicErectorPayload(baseInput("United States"), archetype);
    const scores = calculateAllScores({
      input: baseInput("United States"),
      archetypeResolution: archetype,
      marketAnalysis: outputs.marketAnalysis,
      competitorAnalysis: outputs.competitorAnalysis,
      timingAnalysis: outputs.timingAnalysis,
    });
    const sims = await buildTimeSimulations(baseInput("United States"), archetype, scores, "ac-sim");
    const d90 = sims.find((s) => s.timeframe === "90d");
    const d1y = sims.find((s) => s.timeframe === "1yr");
    const pass = Boolean(d90 && d1y && simDailyAverage(d90) > simDailyAverage(d1y));
    results.push(erectorAc(32, "90d > 1yr daily intensity", pass));
    expect(pass).toBe(true);
  });

  it("33 — archetype timeframe multiplier affects simulations", async () => {
    const scores = calculateAllScores({
      input: baseInput("United States"),
      archetypeResolution: resolutionFromNumber(1),
      marketAnalysis: { demandScore: 6 },
      competitorAnalysis: { competitors: [{ name: "A" }] },
      timingAnalysis: { momentumScore: 6 },
    });
    const a1 = await buildTimeSimulations(baseInput("United States"), resolutionFromNumber(1), scores, "a1");
    const a6 = await buildTimeSimulations(baseInput("United States"), resolutionFromNumber(6), scores, "a6");
    const s90_1 = a1.find((s) => s.timeframe === "90d");
    const s90_6 = a6.find((s) => s.timeframe === "90d");
    const pass = Boolean(s90_1 && s90_6 && simDailyAverage(s90_1) !== simDailyAverage(s90_6));
    results.push(erectorAc(33, "archetype timeframe mult visible", pass));
    expect(pass).toBe(true);
  });

  it("37–38 — dashboard UI surfaces execution context and smoke badge", () => {
    const panel = readFileSync(
      resolve(repoRoot, "artifacts/torgima/src/components/dashboard/ExecutionContextPanel.tsx"),
      "utf8",
    );
    const action = readFileSync(
      resolve(repoRoot, "artifacts/torgima/src/components/dashboard/CurrentActionPanel.tsx"),
      "utf8",
    );
    const pass37 = /realityScore|reality_score/i.test(panel) && /blueprintTier|blueprint_tier/i.test(panel);
    const pass38 =
      /erector_first_week_seed/.test(action) && /Smoke Test — Week 1/.test(action);
    results.push(erectorAc(37, "Execution Context panel", pass37));
    results.push(erectorAc(38, "Smoke Test indicator", pass38));
    expect(pass37 && pass38).toBe(true);
  });
});

describe.skipIf(!run)("Erector acceptance criteria 21–41 (integration)", () => {
  const results: ErectorAcResult[] = [];
  const userIds: string[] = [];

  afterEach(async () => {
    for (const id of userIds.splice(0)) {
      await cleanupErectorFixture(id);
    }
  });

  afterAll(() => {
    console.log(formatErectorAcceptanceReport(results));
  });

  it("21b — DB archetype count", async () => {
    const count = await countArchetypesWithSubstance();
    results.push(erectorAc(21, "DB archetypes seeded", count >= 30, `count=${count}`));
    expect(count).toBeGreaterThanOrEqual(30);
  });

  it("22 — Nigeria vs Germany divergence", async () => {
    const ng = await seedErectorFixture("erectorArchetypeNigeria");
    const de = await seedErectorFixture("erectorArchetypeGermany");
    userIds.push(ng.userId, de.userId);
    const [vNg] = await db.select().from(validations).where(eq(validations.id, ng.validationId)).limit(1);
    const [vDe] = await db.select().from(validations).where(eq(validations.id, de.validationId)).limit(1);
    const archNg = vNg?.archetype_resolution as ArchetypeResolutionOutput | null;
    const archDe = vDe?.archetype_resolution as ArchetypeResolutionOutput | null;
    const scoreKeys = [
      "market_score",
      "execution_score",
      "local_economy_score",
      "competition_score",
      "timing_score",
    ] as const;
    let diffCount = 0;
    for (const k of scoreKeys) {
      const a = Number(vNg?.[k] ?? 0);
      const b = Number(vDe?.[k] ?? 0);
      if (Math.abs(a - b) > 1) diffCount++;
    }
    const pass =
      archNg?.primaryArchetype.archetypeNumber !== archDe?.primaryArchetype.archetypeNumber &&
      JSON.stringify(vNg?.economy_briefing) !== JSON.stringify(vDe?.economy_briefing) &&
      diffCount >= 3;
    results.push(erectorAc(22, "Nigeria vs Germany divergence", pass));
    expect(pass).toBe(true);
  });

  it("23 — Iran payment warning in economy briefing", async () => {
    const fx = await seedErectorFixture("erectorArchetypeIran");
    userIds.push(fx.userId);
    const [row] = await db.select().from(validations).where(eq(validations.id, fx.validationId)).limit(1);
    const text = JSON.stringify(row?.economy_briefing ?? {});
    const warnings = (row?.archetype_resolution as ArchetypeResolutionOutput | null)?.economySpecificWarnings ?? [];
    const pass =
      /payment|transfer|sanction/i.test(text) ||
      warnings.some((w) => /payment/i.test(w));
    results.push(erectorAc(23, "Iran payment warning", pass));
    expect(pass).toBe(true);
  });

  it("24 — corruption-heavy briefing guidance", async () => {
    const archetype = resolutionFromNumber(16);
    const outputs = buildDeterministicErectorPayload(baseInput("Venezuela"), archetype);
    const briefing = JSON.stringify(outputs.economyBriefing);
    const pass = /relationship|connection|trust|verification/i.test(briefing);
    results.push(erectorAc(24, "corruption guidance", pass));
    expect(pass).toBe(true);
  });

  it("26 — fallback fixture logs", async () => {
    const fx = await seedErectorFixture("erectorFallbackMode");
    userIds.push(fx.userId);
    const logs = await db.select().from(bhudhiLogs).where(eq(bhudhiLogs.blueprint_id, fx.blueprintId));
    const [val] = await db.select().from(validations).where(eq(validations.id, fx.validationId)).limit(1);
    const pass =
      logs.length >= 10 &&
      logs.every((l) => l.fallback_used === true) &&
      (val?.reality_score ?? 0) > 0;
    results.push(erectorAc(26, "fallback mode fixture", pass));
    expect(pass).toBe(true);
  });

  it("28–31 — launch guards and proceed path", async () => {
    const blocked = await seedErectorFixture("erectorValidationBlocked");
    const pivot = await seedErectorFixture("erectorValidationPivot");
    const adjust = await seedErectorFixture("erectorValidationAdjust");
    const proceed = await seedErectorFixture("erectorValidationProceed");
    userIds.push(blocked.userId, pivot.userId, adjust.userId, proceed.userId);

    await expect(
      ValidationService.assertLaunchAllowed(blocked.blueprintId, blocked.userId, blocked.validationContractId),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await db
      .update(validations)
      .set({ selected_path: "current", selected_path_type: "current" })
      .where(eq(validations.id, pivot.validationId));
    await expect(
      ValidationService.assertLaunchAllowed(pivot.blueprintId, pivot.userId, pivot.validationContractId),
    ).rejects.toMatchObject({ message: expect.stringMatching(/Pivot/i) });

    await db
      .update(validations)
      .set({ selected_path: "current", selected_path_type: "current", adjusted_path_confirmed: false })
      .where(eq(validations.id, adjust.validationId));
    await expect(
      ValidationService.assertLaunchAllowed(adjust.blueprintId, adjust.userId, adjust.validationContractId),
    ).rejects.toMatchObject({ message: expect.stringMatching(/adjusted/i) });

    await expect(
      ValidationService.assertLaunchAllowed(proceed.blueprintId, proceed.userId, proceed.validationContractId),
    ).resolves.toBeUndefined();

    results.push(erectorAc(28, "blocked launch", true));
    results.push(erectorAc(29, "pivot requires alternative", true));
    results.push(erectorAc(30, "adjust requires adjusted path", true));
    results.push(erectorAc(31, "proceed launches allowed", true));
  });

  it("34 — three paths on validation rows", async () => {
    const fx = await seedErectorFixture("erectorValidationProceed");
    userIds.push(fx.userId);
    const [row] = await db.select().from(validations).where(eq(validations.id, fx.validationId)).limit(1);
    const pass = Boolean(row?.path_current && row?.path_adjusted && row?.path_alternative);
    results.push(erectorAc(34, "three paths generated", pass));
    expect(pass).toBe(true);
  });

  it("35 — first-week 404 before path selection", async () => {
    const fx = await seedErectorFixture("erectorValidationPivot");
    userIds.push(fx.userId);
    const { baseUrl, close } = await startErectorTestServer();
    try {
      const { headers } = await createSessionForUser(fx.userId);
      const res = await jsonFetch(`${baseUrl}/api/v1/validation/${fx.validationId}/first-week`, { headers });
      results.push(erectorAc(35, "first-week 404 before path", res.res.status === 404));
      expect(res.res.status).toBe(404);
    } finally {
      await close();
    }
  });

  it("36 — launched fixture smoke orders", async () => {
    const fx = await seedErectorFixture("erectorBlueprintLaunched");
    userIds.push(fx.userId);
    const rows = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, fx.blueprintId),
          eq(orders.generation_reason, "erector_first_week_seed"),
        ),
      );
    const pass =
      rows.length === 7 &&
      rows.filter((o) => o.status === OrderStatus.PENDING).length >= 1 &&
      rows.filter((o) => o.status === OrderStatus.PRE_GENERATED).length >= 6;
    results.push(erectorAc(36, "7 smoke seed orders", pass));
    expect(rows).toHaveLength(7);
  });

  it("37b — dashboard execution context from launched fixture", async () => {
    const fx = await seedErectorFixture("erectorBlueprintLaunched");
    userIds.push(fx.userId);
    const dash = await DashboardService.getDashboardState(fx.userId);
    const ctx = (dash.activeBlueprint as { executionContext?: Record<string, unknown> } | null)
      ?.executionContext;
    const pass = Boolean(ctx && (ctx.realityScore != null || ctx.reality_score != null));
    results.push(erectorAc(37, "dashboard execution context API", pass));
    expect(pass).toBe(true);
  });

  it("39 — post-smoke task generation reason", async () => {
    const fx = await seedErectorFixture("erectorSmokeTestsComplete");
    userIds.push(fx.userId);
    await generate({
      blueprintId: fx.blueprintId,
      userId: fx.userId,
      generationMode: "post_feedback",
      generationTrigger: "smoke_tests_complete",
    });
    const recent = await db
      .select()
      .from(orders)
      .where(eq(orders.blueprint_id, fx.blueprintId))
      .orderBy(sql`${orders.created_at} DESC`)
      .limit(3);
    const normal = recent.find((o) => o.generation_reason !== "erector_first_week_seed");
    const pass = Boolean(normal);
    results.push(erectorAc(39, "normal execution after smoke", pass));
    expect(pass).toBe(true);
  });

  it("40 — stuck validation health warn log", async () => {
    const stuck = await seedStuckValidationFixture();
    userIds.push(stuck.userId);
    await runIntegrityChecks();
    const [log] = await db
      .select()
      .from(systemHealthLogs)
      .where(eq(systemHealthLogs.check_type, "validation_pipeline"))
      .orderBy(sql`${systemHealthLogs.created_at} DESC`)
      .limit(1);
    const pass = log?.status === "warn" || log?.severity === "WARN";
    results.push(erectorAc(40, "validation pipeline warn", pass));
    expect(pass).toBe(true);
  });
});
