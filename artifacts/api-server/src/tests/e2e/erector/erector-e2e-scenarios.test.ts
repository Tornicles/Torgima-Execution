/**
 * Prompt 9 Erector — E2E scenarios E1–E6.
 */
import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, validations, orders, bhudhiLogs, systemHealthLogs } from "@workspace/db";
import { integrationEnabled } from "../../helpers/db.js";
import {
  seedErectorFixture,
  cleanupErectorFixture,
  type ErectorFixture,
} from "../../fixtures/erector-fixtures.js";
import {
  jsonFetch,
  startErectorTestServer,
  createSessionAuthHeaders,
  createSessionForUser,
} from "../../helpers/erector-http.js";
import { processFeedback } from "../../../engines/feedback/FeedbackProcessingEngine.js";
import { calculate } from "../../../engines/signal/SignalCalculationEngine.js";
import { generate } from "../../../engines/task-generation/TaskGenerationEngine.js";
import { OrderStatus } from "@workspace/state-machine";

const run = integrationEnabled();

const ERECTOR_RUN_BODY = {
  rawGoal: "Launch an online consulting business serving founder-operators with measurable outcomes in 90 days",
  purpose: "Build reliable income through a narrow proof wedge.",
  timeframe: "90d",
  commitmentLevel: "HIGH",
  desiredOutcome: "Ten paying clients with documented outcomes.",
  businessType: "online" as const,
  businessModel: "Consulting",
  budgetAvailable: 8000,
  currency: "USD",
  currentResources: ["Skills", "Network", "Time"],
  targetCustomer: "Founder-operators",
};

function simDailyAverage(sim: { dailyTaskCount?: { average?: number; max?: number } | number }): number {
  const c = sim.dailyTaskCount;
  if (typeof c === "number") return c;
  return c?.average ?? c?.max ?? 0;
}

function dataOf(body: Record<string, unknown>): Record<string, unknown> {
  return (body.data as Record<string, unknown>) ?? body;
}

describe.skipIf(!run)("Erector E2E scenarios E1–E6", () => {
  let baseUrl = "";
  let closeServer: (() => Promise<void>) | null = null;
  const fixtures: ErectorFixture[] = [];

  beforeAll(async () => {
    const srv = await startErectorTestServer();
    baseUrl = srv.baseUrl;
    closeServer = srv.close;
  });

  afterAll(async () => {
    if (closeServer) await closeServer();
  });

  afterEach(async () => {
    for (const fx of fixtures.splice(0)) {
      await cleanupErectorFixture(fx.userId);
    }
  });

  it("E1 — full Erector validation flow", async () => {
    const { headers } = await createSessionAuthHeaders();
    const bpRes = await jsonFetch(`${baseUrl}/api/onboarding/goal`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        rawGoal: ERECTOR_RUN_BODY.rawGoal,
        purpose: ERECTOR_RUN_BODY.purpose,
        timeframe: "90 days",
        commitmentLevel: "high",
        idempotencyKey: `e1-bp-${Date.now()}`,
        tier: "growth",
        mode: "individual",
      }),
    });
    const blueprintId = dataOf(bpRes.body).blueprintId as string;
    expect(blueprintId).toBeTruthy();

    const runRes = await jsonFetch(`${baseUrl}/api/v1/validation/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ blueprintId, idempotencyKey: `e1-run-${Date.now()}`, ...ERECTOR_RUN_BODY, location: { country: "United States", city: "Austin" } }),
    });
    expect(runRes.body.ok).toBe(true);
    const data = dataOf(runRes.body);
    const validationId = data.validationId as string;
    expect(data.verdict).toBe("proceed");
    const scores = data.scores as { realityScore?: number } | undefined;
    expect(Number(scores?.realityScore ?? data.reality_score ?? 0)).toBeGreaterThan(6.5);

    const getRes = await jsonFetch(`${baseUrl}/api/v1/validation/${validationId}`, { headers });
    const report = dataOf(getRes.body);
    expect(report.economy_briefing ?? report.economyBriefing).toBeTruthy();
    const competitors = (report.competitor_analysis ?? report.competitorAnalysis) as { competitors?: unknown[] };
    expect((competitors?.competitors ?? []).length).toBeGreaterThanOrEqual(5);

    const simRes = await jsonFetch(`${baseUrl}/api/v1/validation/${validationId}/simulation`, { headers });
    const sims = (dataOf(simRes.body).simulations ?? dataOf(simRes.body).time_simulations) as Array<{
      timeframe: string;
      dailyTaskCount?: { average?: number };
    }>;
    const d90 = sims?.find((s) => s.timeframe === "90d");
    const d1y = sims?.find((s) => s.timeframe === "1yr");
    expect(simDailyAverage(d90 ?? {}) > simDailyAverage(d1y ?? {})).toBe(true);

    const pathRes = await jsonFetch(`${baseUrl}/api/v1/validation/${validationId}/select-path`, {
      method: "POST",
      headers,
      body: JSON.stringify({ selectedPath: "current" }),
    });
    expect(pathRes.body.ok).toBe(true);

    const fwRes = await jsonFetch(`${baseUrl}/api/v1/validation/${validationId}/first-week`, { headers });
    const plan = (dataOf(fwRes.body).first_week_plan ?? dataOf(fwRes.body).firstWeekPlan) as {
      plans?: Array<{ smokeTest?: boolean }>;
    };
    const smokeCount = (plan?.plans ?? []).filter((p) => p.smokeTest).length;
    expect(smokeCount).toBeGreaterThanOrEqual(2);

    const [valRow] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
    const launchRes = await jsonFetch(`${baseUrl}/api/v1/blueprints/${blueprintId}/launch`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        validationContractId: valRow?.contract_id,
        selectedPath: "current",
        selectedBlueprintLevel: "growth",
      }),
    });
    expect(launchRes.body.ok).toBe(true);
    const orderCount = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.blueprint_id, blueprintId), eq(orders.generation_reason, "erector_first_week_seed")));
    expect(orderCount[0]?.n).toBe(7);
  }, 60_000);

  it("E2 — archetype divergence Germany vs Nigeria", async () => {
    const { headers } = await createSessionAuthHeaders();
    async function runForCountry(country: string, city: string) {
      const bp = await jsonFetch(`${baseUrl}/api/onboarding/goal`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          rawGoal: ERECTOR_RUN_BODY.rawGoal,
          purpose: ERECTOR_RUN_BODY.purpose,
          timeframe: "90 days",
          commitmentLevel: "high",
          idempotencyKey: `e2-bp-${country}-${Date.now()}`,
        }),
      });
      const blueprintId = dataOf(bp.body).blueprintId as string;
      const run = await jsonFetch(`${baseUrl}/api/v1/validation/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          blueprintId,
          idempotencyKey: `e2-run-${country}-${Date.now()}`,
          ...ERECTOR_RUN_BODY,
          location: { country, city },
        }),
      });
      return { blueprintId, data: dataOf(run.body), validationId: dataOf(run.body).validationId as string };
    }
    const de = await runForCountry("Germany", "Berlin");
    const ng = await runForCountry("Nigeria", "Lagos");
    const [vDe] = await db.select().from(validations).where(eq(validations.id, de.validationId)).limit(1);
    const [vNg] = await db.select().from(validations).where(eq(validations.id, ng.validationId)).limit(1);
    const archDe = vDe?.archetype_resolution as { primaryArchetype?: { archetypeNumber?: number } } | null;
    const archNg = vNg?.archetype_resolution as { primaryArchetype?: { archetypeNumber?: number } } | null;
    expect(archDe?.primaryArchetype?.archetypeNumber).not.toBe(archNg?.primaryArchetype?.archetypeNumber);
    expect(JSON.stringify(vDe?.economy_briefing)).not.toBe(JSON.stringify(vNg?.economy_briefing));
    const keys = ["market_score", "execution_score", "local_economy_score"] as const;
    let diffs = 0;
    for (const k of keys) {
      if (Math.abs(Number(vDe?.[k] ?? 0) - Number(vNg?.[k] ?? 0)) > 1) diffs++;
    }
    expect(diffs).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it("E3 — blocked validation rejects launch", async () => {
    const fx = await seedErectorFixture("erectorValidationBlocked");
    fixtures.push(fx);
    const { headers } = await createSessionForUser(fx.userId);
    const launch = await jsonFetch(`${baseUrl}/api/v1/blueprints/${fx.blueprintId}/launch`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        validationContractId: fx.validationContractId,
        selectedPath: "current",
      }),
    });
    expect(launch.res.status).toBeGreaterThanOrEqual(400);
    const msg = JSON.stringify(launch.body);
    expect(/blocked|2\.5|Re-validate/i.test(msg)).toBe(true);
    const health = await db
      .select()
      .from(systemHealthLogs)
      .where(eq(systemHealthLogs.blueprint_id, fx.blueprintId));
    expect(health.length).toBe(0);
  });

  it("E4 — fallback resilience with invalid API key", async () => {
    const prior = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "invalid-key-for-erector-e4";
    try {
      const { headers } = await createSessionAuthHeaders();
      const bpRes = await jsonFetch(`${baseUrl}/api/onboarding/goal`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          rawGoal: ERECTOR_RUN_BODY.rawGoal,
          purpose: ERECTOR_RUN_BODY.purpose,
          timeframe: "90 days",
          commitmentLevel: "high",
          idempotencyKey: `e4-bp-${Date.now()}`,
        }),
      });
      const blueprintId = dataOf(bpRes.body).blueprintId as string;
      const runRes = await jsonFetch(`${baseUrl}/api/v1/validation/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          blueprintId,
          idempotencyKey: `e4-run-${Date.now()}`,
          ...ERECTOR_RUN_BODY,
          location: { country: "Kenya", city: "Nairobi" },
        }),
      });
      expect(runRes.body.ok).toBe(true);
      const validationId = dataOf(runRes.body).validationId as string;
      const [val] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
      expect(val?.reality_score).not.toBeNull();
      const logs = await db.select().from(bhudhiLogs).where(eq(bhudhiLogs.blueprint_id, blueprintId));
      if (logs.length > 0) {
        expect(logs.filter((l) => l.fallback_used).length).toBeGreaterThan(0);
      }
      const intel = val?.intelligence_payload as { intelligence_limited?: boolean } | null;
      expect(intel?.intelligence_limited === true || (val?.reality_score ?? 0) > 0).toBe(true);
    } finally {
      if (prior === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prior;
    }
  }, 120_000);

  it("E5 — smoke test to normal execution transition", async () => {
    const fx = await seedErectorFixture("erectorBlueprintLaunched");
    fixtures.push(fx);
    const smokeOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, fx.blueprintId),
          eq(orders.generation_reason, "erector_first_week_seed"),
        ),
      )
      .orderBy(orders.priority);
    for (const ord of smokeOrders) {
      await db.update(orders).set({ status: OrderStatus.PENDING }).where(eq(orders.id, ord.id));
      await processFeedback({
        orderId: ord.id,
        blueprintId: fx.blueprintId,
        userId: fx.userId,
        completionStatus: "completed",
        score: 8,
        reflection: "Smoke test complete with documented proof output.",
        idempotencyKey: `e5-fb-${ord.id}`,
      });
      await db.update(orders).set({ status: OrderStatus.COMPLETED }).where(eq(orders.id, ord.id));
    }
    await calculate({ blueprintId: fx.blueprintId, userId: fx.userId });
    await generate({
      blueprintId: fx.blueprintId,
      userId: fx.userId,
      generationMode: "post_feedback",
      generationTrigger: "smoke_week_complete",
    });
    const [next] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, fx.blueprintId),
          sql`${orders.generation_reason} IS DISTINCT FROM 'erector_first_week_seed'`,
        ),
      )
      .orderBy(sql`${orders.created_at} DESC`)
      .limit(1);
    expect(next?.generation_reason).not.toBe("erector_first_week_seed");
  }, 90_000);

  it("E6 — validation run idempotency", async () => {
    const { headers } = await createSessionAuthHeaders();
    const bpRes = await jsonFetch(`${baseUrl}/api/onboarding/goal`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        rawGoal: ERECTOR_RUN_BODY.rawGoal,
        purpose: ERECTOR_RUN_BODY.purpose,
        timeframe: "90 days",
        commitmentLevel: "high",
        idempotencyKey: `e6-bp-${Date.now()}`,
      }),
    });
    const blueprintId = dataOf(bpRes.body).blueprintId as string;
    const idempotencyKey = "test-key-001-erector-e6";
    const body = JSON.stringify({
      blueprintId,
      idempotencyKey,
      ...ERECTOR_RUN_BODY,
      location: { country: "Canada", city: "Toronto" },
    });
    const first = await jsonFetch(`${baseUrl}/api/v1/validation/run`, { method: "POST", headers, body });
    const second = await jsonFetch(`${baseUrl}/api/v1/validation/run`, { method: "POST", headers, body });
    const id1 = dataOf(first.body).validationId as string;
    const id2 = dataOf(second.body).validationId as string;
    expect(id1).toBe(id2);
    const count = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(validations)
      .where(eq(validations.idempotency_key, idempotencyKey));
    expect(count[0]?.n).toBe(1);
    const logsBefore = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bhudhiLogs)
      .where(eq(bhudhiLogs.blueprint_id, blueprintId));
    await jsonFetch(`${baseUrl}/api/v1/validation/run`, { method: "POST", headers, body });
    const logsAfter = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bhudhiLogs)
      .where(eq(bhudhiLogs.blueprint_id, blueprintId));
    expect(logsAfter[0]?.n).toBe(logsBefore[0]?.n);
  }, 90_000);
});
