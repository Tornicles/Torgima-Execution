/**
 * PROMPT 8 — Full lifecycle verification (Free → Paid → Baseline → Execution → Adaptation).
 *
 * Runs only when `TORGIMA_INTEGRATION=true` and `DATABASE_URL` points at a real Postgres.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  pool,
  blueprints,
  orders,
  feedback as feedbackTable,
  signalSnapshots,
  conditions,
  enforcementPackages,
  erectorFreeValidations,
  erectorIntakeSessions,
  handoffTokens,
  erectorRealityPackages,
  plans,
  phases,
  projects,
  actions,
  events,
} from "@workspace/db";
import { integrationEnabled, createTestUser, cleanupTestUser } from "../helpers/db.js";
import { jsonFetch, startErectorTestServer, createSessionForUser } from "../helpers/erector-http.js";
import { drainEventsForTest } from "../../services/EventLoopProcessor.js";
import { EventTypes } from "../../types/eventContracts.js";
import { OrderStatus } from "@workspace/state-machine";

const run = integrationEnabled();

function dataOf(body: Record<string, unknown>): Record<string, unknown> {
  return (body.data as Record<string, unknown>) ?? body;
}

async function resetEventTables(): Promise<void> {
  // Test setup only: ensure we start from a clean queue so backlog doesn't mask lifecycle results.
  await pool.query("DELETE FROM dead_letter_events");
  await db.delete(events);
  // Prevent rate-limit contamination across repeated runs (free validations are IP-hash limited).
  await db.delete(erectorFreeValidations);
  await db.delete(handoffTokens);
}

describe.skipIf(!run)("PROMPT 8 — TORGIMA full lifecycle E2E", () => {
  let baseUrl = "";
  let closeServer: (() => Promise<void>) | null = null;

  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await resetEventTables();
    const srv = await startErectorTestServer();
    baseUrl = srv.baseUrl;
    closeServer = srv.close;
  }, 180_000);

  afterAll(async () => {
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
    if (closeServer) await closeServer();
  }, 180_000);

  it(
    "runs full lifecycle chain: free → handoff → intake → baseline → execution → feedback → signals/condition → adaptation",
    async () => {
      // -----------------------
      // Phase 3: Free Erector (no auth)
      // -----------------------
      const freeRes = await jsonFetch(`${baseUrl}/api/erector/free/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea_or_goal:
            "I want to build a fitness content brand for beginners who want to lose weight",
          industry_or_domain: "Health and fitness content",
          location: "Brazil",
          budget_range: "$0-$500",
          timeline: "90 days",
          additional_context: "I can work part-time and post on TikTok and Instagram.",
          fingerprint: `fp-e2e-${Date.now()}`,
          anonymous_session_id: `sess-e2e-${Date.now()}`,
        }),
      });

      expect(freeRes.res.status).toBe(200);
      expect(freeRes.body.ok).toBe(true);
      const free = dataOf(freeRes.body);
      const freeValidationId = String(free.validation_id ?? "");
      const handoffRaw = String(free.handoff_token ?? "");
      expect(freeValidationId).toMatch(/[0-9a-f-]{36}/i);
      expect(handoffRaw.length).toBeGreaterThan(10);
      expect(free.is_free_tier_preview).toBe(true);
      expect(typeof free.recommended_direction).toBe("string");
      expect(Array.isArray(free.top_risks)).toBe(true);
      expect(Array.isArray(free.top_opportunities)).toBe(true);
      expect(free.current_path && typeof free.current_path === "object").toBe(true);
      expect(free.adjusted_path && typeof free.adjusted_path === "object").toBe(true);
      expect(free.alternative_path && typeof free.alternative_path === "object").toBe(true);

      // DB verification: free validation row exists + handoff token created.
      const [freeRow] = await db
        .select()
        .from(erectorFreeValidations)
        .where(eq(erectorFreeValidations.id, freeValidationId))
        .limit(1);
      expect(freeRow).toBeTruthy();
      expect(freeRow?.validation_score).not.toBeNull();
      expect(String(freeRow?.verdict ?? "")).not.toBe("");
      expect(freeRow?.handoff_token_id).toBeTruthy();

      const [handoffRow] = await db
        .select()
        .from(handoffTokens)
        .where(eq(handoffTokens.id, freeRow!.handoff_token_id!))
        .limit(1);
      expect(handoffRow).toBeTruthy();
      expect(handoffRow?.source_tier).toBe("free");
      expect(handoffRow?.target_tier).toBe("torgima");
      expect(handoffRow?.consumed).toBe(false);

      // Hard rule: free flow must not create blueprint or orders.
      const [bpCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(blueprints)
        .where(eq(blueprints.validation_id, freeValidationId));
      expect(bpCount?.n ?? 0).toBe(0);

      // -----------------------
      // Phase 4: Free report retrieval
      // -----------------------
      const reportRes = await jsonFetch(`${baseUrl}/api/erector/free/report/${freeValidationId}`, {
        headers: { "Content-Type": "application/json" },
      });
      expect(reportRes.res.status).toBe(200);
      const report = dataOf(reportRes.body);
      expect(report.validation_id).toBe(freeValidationId);
      expect(report.is_free_tier_preview).toBe(true);
      expect(String(report.verdict_label ?? "")).not.toMatch(/\b(PROCEED|ADJUST|PIVOT|DELAY|TEST_FIRST|BLOCKED)\b/);

      // -----------------------
      // Phase 5: Auth / upgrade / handoff
      // -----------------------
      const user = await createTestUser({ tier: "growth", dashboard_mode: "limited_activation" });
      createdUserIds.push(user.id);
      const authA = await createSessionForUser(user.id);

      // Protected route should reject without auth
      const noAuth = await jsonFetch(`${baseUrl}/api/state/dashboard`, {
        headers: { "Content-Type": "application/json" },
      });
      expect([401, 403]).toContain(noAuth.res.status);

      // Create blueprint shell (Prompt 5 expectation).
      const bpRes = await jsonFetch(`${baseUrl}/api/blueprints`, {
        method: "POST",
        headers: authA.headers,
        body: JSON.stringify({
          goal: "Launch a beginner fitness content brand with 10k followers and first revenue in 90 days",
          purpose: "Help beginners lose weight with a simple plan and daily proof loop.",
          timeframeDays: 90,
          commitmentLevel: "high",
          tier: "growth",
        }),
      });
      expect(bpRes.res.status, JSON.stringify(bpRes.body)).toBe(201);
      const blueprintId = String(dataOf(bpRes.body).blueprintId ?? "");
      expect(blueprintId).toMatch(/[0-9a-f-]{36}/i);

      // Create intake session with handoff token and blueprint_id.
      const intakeRes = await jsonFetch(`${baseUrl}/api/erector/intake/session`, {
        method: "POST",
        headers: authA.headers,
        body: JSON.stringify({
          tier: "authenticated",
          blueprint_id: blueprintId,
          handoff_token: handoffRaw,
        }),
      });
      expect([200, 201]).toContain(intakeRes.res.status);
      const intake = dataOf(intakeRes.body);
      const intakeId = String(intake.id ?? "");
      expect(intakeId).toMatch(/[0-9a-f-]{36}/i);
      expect(intake.prefilled_from_handoff).toBe(true);

      // Handoff token must now be consumed (free tokens are single-use for intake prefill).
      const [handoffAfter] = await db
        .select()
        .from(handoffTokens)
        .where(eq(handoffTokens.id, handoffRow!.id))
        .limit(1);
      expect(handoffAfter?.consumed).toBe(true);

      // -----------------------
      // Phase 6: Complete intake
      // -----------------------
      async function patch(section: number, data: Record<string, unknown>) {
        const r = await jsonFetch(`${baseUrl}/api/erector/intake/session/${intakeId}/section`, {
          method: "PATCH",
          headers: authA.headers,
          body: JSON.stringify({ section, data }),
        });
        expect(r.res.status).toBe(200);
      }

      await patch(1, {
        projectName: "Beginner Fitness Content Brand",
        project_name: "Beginner Fitness Content Brand",
        whatBuilding:
          "A fitness content brand for absolute beginners: daily short videos + a simple beginner program.",
        what_building:
          "A fitness content brand for absolute beginners: daily short videos + a simple beginner program.",
        desiredOutcome: "First paying customers and consistent weekly content output within 90 days.",
        desired_outcome: "First paying customers and consistent weekly content output within 90 days.",
        whyItMatters: "Beginners need simple routines they can stick to.",
        why_it_matters: "Beginners need simple routines they can stick to.",
        industry: "Health and fitness content",
      });
      await patch(2, {
        who: "Beginners who want to lose weight and need simple routines.",
        target_who: "Beginners who want to lose weight and need simple routines.",
        problem: "They don’t know what to do consistently and quit quickly.",
        problem_solved: "They don’t know what to do consistently and quit quickly.",
        urgency: "medium",
        problem_urgency: "medium",
        payingForAlternatives: true,
        paying_for_alternatives: true,
      });
      await patch(3, {
        location: "Brazil",
        scope: "Brazil + Portuguese-speaking beginners",
        market_scope: "Brazil + Portuguese-speaking beginners",
        competitors: "Top Brazilian fitness creators; beginner program sellers",
        differentiation: "Beginner-first, proof-based habit loop, low-friction start.",
        industry: "Health and fitness content",
      });
      await patch(4, {
        revenueModel: "Digital products + affiliate + coaching",
        revenue_model: "Digital products + affiliate + coaching",
        priceRange: "$10-$50",
        price_range: "$10-$50",
        modelType: "digital_product",
        revenue_type: "digital_product",
      });
      await patch(5, {
        budget: "$0-$500",
        budget_range: "$0-$500",
        hoursPerWeek: 10,
        hours_per_week: 10,
        skillsPresent: "Video editing, basic fitness knowledge, content posting",
        skillsMissing: "Offer design, sales copy, conversion funnel",
        teamSize: 1,
        team_size: 1,
      });
      await patch(6, {
        launchDate: "90 days",
        timeline_launch: "90 days",
        firstCustomersDate: "30 days",
        timeline_customers: "30 days",
        finalTargetDate: "12 months",
        timeline_final: "12 months",
      });
      await patch(7, {
        known_blockers: "Consistency risk; crowded market; offer design unclear early.",
        blockers: "Consistency risk; crowded market; offer design unclear early.",
        legal_barriers: "none",
        technical_barriers: "none",
        financial_barriers: "low budget",
        prior_attempts: [],
      });
      await patch(8, {
        success30Days: "Post 30 videos and reach 1,000 followers.",
        success_30_days: "Post 30 videos and reach 1,000 followers.",
        success90Days: "Launch first paid beginner program and get 20 customers.",
        success_90_days: "Launch first paid beginner program and get 20 customers.",
        success12Months: "Reach 100k followers and recurring revenue.",
        success_12_months: "Reach 100k followers and recurring revenue.",
      });
      await patch(9, {
        // Optional proof/evidence section — must be saved (even empty) to satisfy 9/9 gate.
        proof_links: "",
        evidence_notes: "",
      });

      // Validate + submit
      const validate = await jsonFetch(`${baseUrl}/api/erector/intake/session/${intakeId}/validate`, {
        method: "POST",
        headers: authA.headers,
      });
      expect(validate.res.status).toBe(200);
      expect(typeof dataOf(validate.body).validation_ready).toBe("boolean");

      const submit = await jsonFetch(`${baseUrl}/api/erector/intake/session/${intakeId}/submit`, {
        method: "POST",
        headers: authA.headers,
      });
      expect([200, 201]).toContain(submit.res.status);
      expect(dataOf(submit.body).validation_ready).toBe(true);

      // -----------------------
      // Phase 7–10: Drain baseline → blueprint execution generation → unlock
      // -----------------------
      await drainEventsForTest({
        batchSize: 10,
        maxBatches: 25,
        allowedEventTypes: [
          EventTypes.ERECTOR_BASELINE_REQUESTED,
          EventTypes.ERECTOR_BASELINE_GENERATING,
          EventTypes.ERECTOR_BASELINE_COMPLETED,
          EventTypes.BLUEPRINT_EXECUTION_GENERATION_REQUESTED,
          EventTypes.BLUEPRINT_EXECUTION_GENERATION_COMPLETED,
          EventTypes.EXECUTION_UNLOCKED,
          EventTypes.TASK_GENERATION_REQUESTED,
          EventTypes.TASK_GENERATION_COMPLETED,
          EventTypes.SIGNAL_RECALCULATION_REQUESTED,
          EventTypes.SIGNAL_CALCULATED,
          EventTypes.CONDITION_EVALUATION_REQUESTED,
          EventTypes.CONDITION_EVALUATED,
          EventTypes.ENFORCEMENT_PACKAGE_CREATED,
          EventTypes.DASHBOARD_REFRESH_REQUESTED,
        ],
        maxRuntimeMs: 30_000,
      });

      // Reality package persisted
      const [pkg] = await db
        .select()
        .from(erectorRealityPackages)
        .where(and(eq(erectorRealityPackages.blueprint_id, blueprintId), eq(erectorRealityPackages.user_id, user.id)))
        .orderBy(desc(erectorRealityPackages.created_at))
        .limit(1);
      expect(pkg).toBeTruthy();
      expect(pkg?.package_json && typeof pkg.package_json === "object").toBe(true);

      // Blueprint updated with baseline + archetype + unlocked execution
      const [bp] = await db
        .select()
        .from(blueprints)
        .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, user.id)))
        .limit(1);
      expect(bp).toBeTruthy();
      expect(bp?.erector_baseline_id).toBeTruthy();
      expect(String(bp?.erector_archetype ?? "")).not.toBe("");
      expect(String(bp?.erector_baseline_state ?? "")).toMatch(/ready|completed|baseline_ready/i);
      expect(String(bp?.execution_state ?? "")).not.toBe("locked");

      // Structure generated
      const [planCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(plans)
        .where(eq(plans.blueprint_id, blueprintId));
      const [phaseCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(phases)
        .where(eq(phases.blueprint_id, blueprintId));
      const [projectCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.blueprint_id, blueprintId));
      const [actionCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(actions)
        .where(eq(actions.blueprint_id, blueprintId));
      expect(planCount?.n ?? 0).toBeGreaterThan(0);
      expect(phaseCount?.n ?? 0).toBeGreaterThan(0);
      expect(projectCount?.n ?? 0).toBeGreaterThan(0);
      expect(actionCount?.n ?? 0).toBeGreaterThan(0);

      // Orders generated with baseline + archetype and linked to actions.
      const orderRows = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, blueprintId),
            inArray(orders.status, [
              OrderStatus.PENDING,
              OrderStatus.ACTIVE,
              OrderStatus.NEEDS_FEEDBACK,
              OrderStatus.NEEDS_PROOF,
            ]),
          ),
        )
        .orderBy(desc(orders.created_at))
        .limit(10);
      expect(orderRows.length).toBeGreaterThan(0);
      const sample = orderRows[0]!;
      expect(sample.action_id).toBeTruthy();
      expect(sample.erector_baseline_id).toBeTruthy();
      expect(String(sample.erector_archetype ?? "")).not.toBe("");
      expect(sample.condition_at_generation).toBeTruthy();

      // Traceability: order → action → project → phase → plan → blueprint
      const traceRes = await pool.query<Record<string, unknown>>(
        `SELECT
           o.id AS order_id,
           o.blueprint_id,
           o.action_id,
           a.project_id,
           p.phase_id,
           ph.plan_id
         FROM orders o
         JOIN actions a ON a.id = o.action_id
         JOIN projects p ON p.id = a.project_id
         JOIN phases ph ON ph.id = p.phase_id
         WHERE o.id = $1
         LIMIT 1`,
        [sample.id],
      );
      const t = (traceRes.rows[0] ?? {}) as Record<string, unknown>;
      expect(t.blueprint_id).toBe(blueprintId);
      expect(t.action_id).toBeTruthy();
      expect(t.project_id).toBeTruthy();
      expect(t.phase_id).toBeTruthy();
      expect(t.plan_id).toBeTruthy();

      // -----------------------
      // Phase 11: Feedback → Signal → Condition
      // -----------------------
      const fbRes = await jsonFetch(`${baseUrl}/api/orders/${sample.id}/feedback`, {
        method: "POST",
        headers: { ...authA.headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          completionStatus: "completed",
          score: 7,
          reflection:
            "I completed the first content task and posted the first beginner fitness video. Engagement was decent and I can repeat this daily.",
          idempotencyKey: `fb-${Date.now()}`,
        }),
      });
      if (fbRes.res.status !== 200) {
        throw new Error(`feedback failed: ${fbRes.res.status} ${JSON.stringify(fbRes.body)}`);
      }
      expect(dataOf(fbRes.body).feedbackId).toBeTruthy();

      // Drain the loop events produced by feedback.
      await drainEventsForTest({
        batchSize: 10,
        maxBatches: 20,
        allowedEventTypes: [
          EventTypes.FEEDBACK_SUBMITTED,
          EventTypes.SIGNAL_RECALCULATION_REQUESTED,
          EventTypes.SIGNAL_CALCULATED,
          EventTypes.CONDITION_EVALUATION_REQUESTED,
          EventTypes.CONDITION_EVALUATED,
          EventTypes.ENFORCEMENT_PACKAGE_CREATED,
          EventTypes.TASK_GENERATION_REQUESTED,
          EventTypes.TASK_GENERATION_COMPLETED,
        ],
        maxRuntimeMs: 30_000,
      });

      const [fbRow] = await db
        .select()
        .from(feedbackTable)
        .where(and(eq(feedbackTable.order_id, sample.id), eq(feedbackTable.user_id, user.id)))
        .orderBy(desc(feedbackTable.created_at))
        .limit(1);
      expect(fbRow).toBeTruthy();

      const [signal] = await db
        .select()
        .from(signalSnapshots)
        .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
        .orderBy(desc(signalSnapshots.created_at))
        .limit(1);
      expect(signal).toBeTruthy();

      const [cond] = await db
        .select()
        .from(conditions)
        .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
        .orderBy(desc(conditions.created_at))
        .limit(1);
      expect(cond).toBeTruthy();
      expect(String(cond?.condition ?? "")).not.toBe("");

      const [enf] = await db
        .select()
        .from(enforcementPackages)
        .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)))
        .orderBy(desc(enforcementPackages.created_at))
        .limit(1);
      expect(enf).toBeTruthy();

      // -----------------------
      // Phase 12: Adaptation — ensure new tasks exist after feedback
      // -----------------------
      const postFeedbackOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, blueprintId),
            inArray(orders.status, [
              OrderStatus.PENDING,
              OrderStatus.ACTIVE,
              OrderStatus.NEEDS_FEEDBACK,
              OrderStatus.NEEDS_PROOF,
            ]),
          ),
        )
        .orderBy(desc(orders.created_at))
        .limit(20);
      expect(postFeedbackOrders.length).toBeGreaterThan(0);
      expect(postFeedbackOrders.some((o) => o.condition_at_generation)).toBe(true);

      // -----------------------
      // Phase 15: Cross-user protection
      // -----------------------
      const userB = await createTestUser({ tier: "growth" });
      createdUserIds.push(userB.id);
      const authB = await createSessionForUser(userB.id);

      const bOrder = await jsonFetch(`${baseUrl}/api/orders/${sample.id}`, { headers: authB.headers });
      expect([403, 404]).toContain(bOrder.res.status);

      const bIntake = await jsonFetch(`${baseUrl}/api/erector/intake/session/${intakeId}`, {
        headers: authB.headers,
      });
      expect([403, 404]).toContain(bIntake.res.status);

      const bBp = await jsonFetch(`${baseUrl}/api/blueprints/${blueprintId}`, { headers: authB.headers });
      expect([403, 404]).toContain(bBp.res.status);

      const bFeedback = await jsonFetch(`${baseUrl}/api/orders/${sample.id}/feedback`, {
        method: "POST",
        headers: { ...authB.headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          completionStatus: "completed",
          score: 7,
          reflection: "Trying to submit feedback on someone else's order should be blocked.",
          idempotencyKey: `fb-b-${Date.now()}`,
        }),
      });
      expect([403, 404]).toContain(bFeedback.res.status);

      // -----------------------
      // Phase 13: Event backlog (critical types must not be pending)
      // -----------------------
      const critical = [
        EventTypes.ERECTOR_BASELINE_REQUESTED,
        EventTypes.ERECTOR_BASELINE_COMPLETED,
        EventTypes.BLUEPRINT_EXECUTION_GENERATION_REQUESTED,
        EventTypes.BLUEPRINT_EXECUTION_GENERATION_COMPLETED,
        EventTypes.FEEDBACK_SUBMITTED,
        EventTypes.SIGNAL_RECALCULATION_REQUESTED,
        EventTypes.SIGNAL_CALCULATED,
        EventTypes.CONDITION_EVALUATION_REQUESTED,
        EventTypes.CONDITION_EVALUATED,
        EventTypes.ENFORCEMENT_PACKAGE_CREATED,
        EventTypes.TASK_GENERATION_REQUESTED,
      ];
      const pendingCritical = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(events)
        .where(and(eq(events.status, "pending"), inArray(events.event_type, critical as unknown as string[])));
      expect(pendingCritical[0]?.n ?? 0).toBe(0);

      // Finally: intake exists, bound to blueprint, submitted.
      const [intakeRow] = await db
        .select()
        .from(erectorIntakeSessions)
        .where(eq(erectorIntakeSessions.id, intakeId))
        .limit(1);
      expect(intakeRow?.blueprint_id).toBe(blueprintId);
      expect(intakeRow?.submitted_at).toBeTruthy();
    },
    180_000,
  );
});

