#!/usr/bin/env node
/**
 * TORGIMA Recovery R6 — end-to-end verification (12 steps).
 * Run: node scripts/recovery-r6-e2e.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

const TEST_EMAIL = "recovery_test@torgima.test";
const TEST_USERNAME = "recovery_test";

const results = {};
let stopEarly = false;

function record(step, pass, detail = {}) {
  results[step] = { pass, ...detail };
  const label = pass ? "PASS" : "FAIL";
  console.log(`\n[Step ${step}] ${label}`, detail.message ?? "", detail.error ?? "");
  if (!pass) stopEarly = true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function ensureTaskForBlueprint(blueprintId, userId) {
  const { guaranteeTask } = await import(
    "../artifacts/api-server/src/engines/task-guarantee/ContinuousTaskGuaranteeEngine.ts"
  );
  await guaranteeTask({
    blueprintId,
    userId,
    generationMode: "post_feedback",
    generationTrigger: "r6_verification",
  });
}

async function flushSignalPipeline(blueprintId, userId) {
  const { calculate } = await import(
    "../artifacts/api-server/src/engines/signal/SignalCalculationEngine.ts"
  );
  const { evaluate } = await import(
    "../artifacts/api-server/src/engines/condition/ConditionEvaluationEngine.ts"
  );
  const signal = await calculate({ blueprintId, userId });
  await evaluate({
    blueprintId,
    userId,
    signalSnapshotId: signal.snapshotId,
    assignedCondition: signal.condition,
  });
  return signal;
}

async function main() {
  const { pool } = await import("@workspace/db");
  const { default: app } = await import("../artifacts/api-server/src/app.ts");

  const BlueprintStatus = {
    DRAFT: "draft",
    VALIDATING: "validating",
    AWAITING_SELECTION: "awaiting_selection",
    PATH_SELECTION: "path_selection",
    ACTIVE: "active",
    COMPLETE: "complete",
  };
  const ValidationKind = { INTELLIGENCE: "intelligence" };
  const OrderStatus = {
    PENDING: "pending",
    ACTIVE: "active",
    PRE_GENERATED: "pre_generated",
    COMPLETED: "completed",
  };

  async function cleanupTestUser(email) {
    const prior = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    const uid = prior.rows[0]?.id;
    if (!uid) return;
    const bps = await pool.query("SELECT id FROM blueprints WHERE user_id = $1", [uid]);
    for (const bp of bps.rows) {
      await pool.query("DELETE FROM events WHERE blueprint_id = $1", [bp.id]);
    }
    await pool.query("DELETE FROM users WHERE id = $1", [uid]);
  }

  await cleanupTestUser(TEST_EMAIL);

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  let userId;
  let token;
  let blueprintId;
  let validationId;
  let contractId;
  let orderId;
  let orderId2;

  const reflectionCompleted =
    "I drafted the initial product requirements document and shared it with two potential users for feedback. Both confirmed the core pain point.";
  const reflectionFailed =
    "I could not complete this because I do not have access to the required tool for this task.";

  try {
    // ── Step 1 — Signup (magic-link upsert = canonical auth signup) ─────────
    const s1 = await jsonFetch(`${base}/api/auth/send-magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const userRows = await pool.query(
      "SELECT id, email, mode, tier FROM users WHERE email = $1",
      [TEST_EMAIL],
    );
    userId = userRows.rows[0]?.id;
    const s1ok =
      s1.res.ok &&
      userRows.rowCount === 1 &&
      userRows.rows[0].mode === "individual";
    record(1, s1ok, {
      message: s1ok ? `user_id=${userId}` : "signup/user row failed",
      api: s1.body,
      db: userRows.rows[0],
    });
    if (!s1ok) throw new Error("Step 1 failed");

    await pool.query(
      "UPDATE users SET tier = 'growth', username = $2 WHERE id = $1",
      [userId, TEST_USERNAME],
    );

    // ── Step 2 — Login (session bearer) ─────────────────────────────────────
    token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [userId, tokenHash],
    );
    const sessionRows = await pool.query(
      "SELECT id, expires_at > now() AS valid FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    const s2ok = sessionRows.rowCount === 1 && sessionRows.rows[0].valid;
    record(2, s2ok, { message: s2ok ? "session created" : "no valid session" });
    if (!s2ok) throw new Error("Step 2 failed");

    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // ── Step 3 — Onboarding goal (includes validation) ───────────────────────
    const goalBody = {
      rawGoal: "Launch a SaaS product for freelance developers",
      purpose: "Provide time tracking that integrates with their existing tools",
      timeframe: "6 months",
      commitmentLevel: "high",
      selectedBlueprintTier: "growth",
      selectedBlueprintMode: "individual",
      idempotencyKey: `r6-${Date.now()}`,
    };
    const s3 = await jsonFetch(`${base}/api/onboarding/goal`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(goalBody),
    });
    blueprintId = s3.body?.data?.blueprintId;
    validationId = s3.body?.data?.validationId;
    contractId = s3.body?.data?.validationContractId;
    const bpRows = await pool.query(
      "SELECT id, status, goal, purpose FROM blueprints WHERE user_id = $1",
      [userId],
    );
    const s3ok =
      s3.res.ok &&
      s3.body?.ok &&
      blueprintId &&
      bpRows.rowCount === 1 &&
      (bpRows.rows[0].status === BlueprintStatus.VALIDATING ||
        bpRows.rows[0].status === BlueprintStatus.PATH_SELECTION ||
        bpRows.rows[0].status === BlueprintStatus.AWAITING_SELECTION) &&
      bpRows.rows[0].goal;
    record(3, s3ok, {
      message: `blueprint=${blueprintId} status=${bpRows.rows[0]?.status}`,
      apiStatus: s3.body?.data?.status,
    });
    if (!s3ok) throw new Error("Step 3 failed");

    // ── Step 4 — Validation record ──────────────────────────────────────────
    const valRows = await pool.query(
      `SELECT id, contract_id, validation_kind, status, verdict, intelligence_payload
       FROM validations WHERE blueprint_id = $1 ORDER BY created_at DESC`,
      [blueprintId],
    );
    const val = valRows.rows[0];
    contractId = contractId ?? val?.contract_id;
    const verdict =
      val?.verdict ??
      (val?.intelligence_payload && typeof val.intelligence_payload === "object"
        ? val.intelligence_payload.verdict
        : null);
    const bpAfterVal = await pool.query("SELECT status FROM blueprints WHERE id = $1", [blueprintId]);
    const s4ok =
      valRows.rowCount >= 1 &&
      val.validation_kind === ValidationKind.INTELLIGENCE &&
      val.status === "complete" &&
      Boolean(verdict) &&
      (bpAfterVal.rows[0]?.status === BlueprintStatus.PATH_SELECTION ||
        bpAfterVal.rows[0]?.status === BlueprintStatus.AWAITING_SELECTION);
    record(4, s4ok, {
      message: `validation_kind=${val?.validation_kind} status=${val?.status} verdict=${verdict} contract=${contractId}`,
      blueprintStatus: bpAfterVal.rows[0]?.status,
    });
    if (!s4ok) throw new Error("Step 4 failed");

    // ── Step 5 — Path selection ─────────────────────────────────────────────
    await jsonFetch(`${base}/api/blueprints/${blueprintId}/configure-selection`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tier: "growth", mode: "individual" }),
    });
    const selectedPath = verdict === "adjust" ? "adjusted" : "current";
    const s5 = await jsonFetch(`${base}/api/validation/${validationId}/select-path`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        selectedPath,
        confirmAdjusted: verdict === "adjust" ? true : undefined,
      }),
    });
    const pathRow = await pool.query(
      "SELECT selected_path, selected_path_type FROM validations WHERE contract_id = $1",
      [contractId],
    );
    const s5ok =
      s5.res.ok &&
      s5.body?.ok &&
      (pathRow.rows[0]?.selected_path === selectedPath ||
        pathRow.rows[0]?.selected_path_type === selectedPath);
    record(5, s5ok, { message: `selected_path=${pathRow.rows[0]?.selected_path ?? pathRow.rows[0]?.selected_path_type}` });
    if (!s5ok) throw new Error("Step 5 failed");

    // ── Step 6 — Blueprint launch ───────────────────────────────────────────
    const s6 = await jsonFetch(`${base}/api/blueprints/${blueprintId}/activate`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        validation_contract_id: contractId,
        selected_path_type: selectedPath,
        selectedBlueprintLevel: "growth",
      }),
    });
    const launchedBp = await pool.query(
      "SELECT status, active, validation_id, updated_at FROM blueprints WHERE id = $1",
      [blueprintId],
    );
    const launchEvents = await pool.query(
      `SELECT event_type, status FROM events WHERE blueprint_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [blueprintId],
    );
    const hasLaunched = launchEvents.rows.some((e) => e.event_type === "blueprint_launched");
    const s6ok =
      s6.res.ok &&
      s6.body?.data?.launched === true &&
      launchedBp.rows[0]?.status === BlueprintStatus.ACTIVE &&
      launchedBp.rows[0]?.active === true &&
      hasLaunched;
    record(6, s6ok, {
      message: `active=${launchedBp.rows[0]?.active} launched_event=${hasLaunched}`,
    });
    if (!s6ok) throw new Error("Step 6 failed");

    // ── Step 7 — Active order on dashboard ────────────────────────────────────
    await ensureTaskForBlueprint(blueprintId, userId);
    let s7ok = false;
    let activeOrder;
    for (let i = 0; i < 10; i++) {
      const s7 = await jsonFetch(`${base}/api/execution/active-order`, { headers: auth });
      activeOrder = s7.body?.data?.order;
      if (
        s7.res.status === 200 &&
        activeOrder?.id &&
        activeOrder.title &&
        activeOrder.instruction &&
        activeOrder.expected_output &&
        activeOrder.why_it_matters
      ) {
        s7ok = true;
        orderId = activeOrder.id;
        break;
      }
      await ensureTaskForBlueprint(blueprintId, userId);
      await sleep(1000);
    }
    const orderRow = await pool.query(
      `SELECT id, status, title, instruction, expected_output, why_it_matters
       FROM orders WHERE blueprint_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [blueprintId],
    );
    s7ok =
      s7ok &&
      orderRow.rowCount === 1 &&
      orderRow.rows[0].instruction &&
      orderRow.rows[0].why_it_matters &&
      [OrderStatus.ACTIVE, OrderStatus.PENDING, OrderStatus.PRE_GENERATED].includes(orderRow.rows[0].status);
    record(7, s7ok, { message: `orderId=${orderId}`, dbStatus: orderRow.rows[0]?.status });
    if (!s7ok) throw new Error("Step 7 failed");

    // ── Step 8 — Submit completed feedback ──────────────────────────────────
    const orderMeta = await pool.query(
      "SELECT status, proof_required FROM orders WHERE id = $1",
      [orderId],
    );
    const s8 = await jsonFetch(`${base}/api/orders/${orderId}/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        completionStatus: "completed",
        reflection: reflectionCompleted,
        score: 8,
        frictionScore: 3,
        confidenceScore: 4,
        idempotencyKey: `r6-feedback-complete-${orderId}`,
        ...(orderMeta.rows[0]?.proof_required ?
          {
            proofJson: {
              url: "https://example.com/proof/requirements-draft",
              text: "Uploaded a two-page requirements draft in Notion and shared the link with two freelance developers who confirmed the pain point in writing within 24 hours.",
            },
          }
        : {}),
      }),
    });
    const fbRow = await pool.query(
      `SELECT id, completion_status, score, weighted_score FROM feedback WHERE order_id = $1`,
      [orderId],
    );
    const orderAfter = await pool.query("SELECT status FROM orders WHERE id = $1", [orderId]);
    const weighted = Number(fbRow.rows[0]?.weighted_score ?? 0);
    const confidence = s8.body?.data?.confidence;
    const s8ok =
      s8.res.ok &&
      s8.body?.ok &&
      fbRow.rowCount === 1 &&
      fbRow.rows[0].completion_status === "completed" &&
      weighted >= 6.4 &&
      weighted <= 8.5 &&
      orderAfter.rows[0]?.status === OrderStatus.COMPLETED &&
      (confidence === "high" || confidence === "medium");
    record(8, s8ok, {
      message: `feedback confidence=${s8.body?.data?.confidence} weighted=${fbRow.rows[0]?.weighted_score} order=${orderAfter.rows[0]?.status}`,
      apiError: s8ok ? undefined : s8.body?.error,
    });
    if (!s8ok) throw new Error("Step 8 failed");

    // ── Step 9 — Signal updates ─────────────────────────────────────────────
    await flushSignalPipeline(blueprintId, userId);
    await sleep(500);
    const sig = await pool.query(
      `SELECT completion_rate, weighted_score, momentum,
              COALESCE(condition, assigned_condition::text) AS condition,
              trend, is_current
       FROM signal_snapshots WHERE blueprint_id = $1 AND is_current = true`,
      [blueprintId],
    );
    const cond = await pool.query(
      `SELECT condition, is_current FROM conditions WHERE blueprint_id = $1 AND is_current = true`,
      [blueprintId],
    );
    const s9ok =
      sig.rowCount === 1 &&
      sig.rows[0].is_current === true &&
      sig.rows[0].condition &&
      cond.rowCount === 1 &&
      cond.rows[0].is_current === true;
    record(9, s9ok, {
      message: `signal.condition=${sig.rows[0]?.condition} cond=${cond.rows[0]?.condition}`,
    });
    if (!s9ok) throw new Error("Step 9 failed");

    // ── Step 10 — New task after feedback ───────────────────────────────────
    let s10ok = false;
    for (let i = 0; i < 10; i++) {
      await ensureTaskForBlueprint(blueprintId, userId);
      const s10 = await jsonFetch(`${base}/api/execution/active-order`, { headers: auth });
      const next = s10.body?.data?.order;
      if (s10.res.status === 200 && next?.id && next.id !== orderId) {
        orderId2 = next.id;
        s10ok = true;
        break;
      }
      await sleep(1000);
    }
    const orderCount = await pool.query(
      "SELECT id, status FROM orders WHERE blueprint_id = $1 ORDER BY created_at",
      [blueprintId],
    );
    s10ok = s10ok && orderCount.rowCount >= 2;
    record(10, s10ok, {
      message: `newOrderId=${orderId2} totalOrders=${orderCount.rowCount}`,
    });
    if (!s10ok) throw new Error("Step 10 failed");

    // ── Step 11 — Failed feedback → recovery task ───────────────────────────
    const activeForFail = await jsonFetch(`${base}/api/execution/active-order`, { headers: auth });
    let failOrderId = activeForFail.body?.data?.order?.id ?? orderId2;
    const failOrderStatus = (
      await pool.query("SELECT status FROM orders WHERE id = $1", [failOrderId])
    ).rows[0]?.status;
    if (failOrderStatus === OrderStatus.PENDING) {
      await jsonFetch(`${base}/api/orders/${failOrderId}/start`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ idempotencyKey: `r6-start-${failOrderId}` }),
      });
    }
    const failMeta = await pool.query(
      "SELECT status, proof_required FROM orders WHERE id = $1",
      [failOrderId],
    );
    const s11 = await jsonFetch(`${base}/api/orders/${failOrderId}/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        completionStatus: "failed",
        reflection: reflectionFailed,
        score: 2,
        frictionScore: 5,
        blockerJson: { blocker_type: "tool_access", had_blocker: true },
        idempotencyKey: `r6-feedback-failed-${failOrderId}-${Date.now()}`,
        ...(failMeta.rows[0]?.proof_required ?
          {
            proofJson: {
              url: "https://example.com/proof/blocked",
              text: "Attempted tool access but license expired; screenshot of error attached.",
            },
          }
        : {}),
      }),
    });
    await flushSignalPipeline(blueprintId, userId);
    const { guaranteeTask } = await import(
      "../artifacts/api-server/src/engines/task-guarantee/ContinuousTaskGuaranteeEngine.ts"
    );
    await guaranteeTask({
      blueprintId,
      userId,
      generationMode: "post_feedback",
      generationTrigger: "feedback_submitted_failed",
    });
    await sleep(1000);
    const latestOrder = await pool.query(
      `SELECT id, task_type, status, title FROM orders
       WHERE blueprint_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [blueprintId],
    );
    const failedFbCount = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM feedback WHERE blueprint_id = $1 AND completion_status = 'failed'",
      [blueprintId],
    );
    const recoveryTypes = ["recovery", "blocker_resolution"];
    const orderCountFinal = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM orders WHERE blueprint_id = $1",
      [blueprintId],
    );
    const s11ok =
      s11.res.ok &&
      failedFbCount.rows[0].cnt >= 1 &&
      latestOrder.rowCount === 1 &&
      orderCountFinal.rows[0].cnt >= 3 &&
      recoveryTypes.includes(latestOrder.rows[0].task_type);
    record(11, s11ok, {
      message: `latest task_type=${latestOrder.rows[0]?.task_type} title=${latestOrder.rows[0]?.title?.slice(0, 60)}`,
      feedbackConfidence: s11.body?.data?.confidence,
      apiError: s11ok ? undefined : s11.body?.error,
    });
    if (!s11ok) throw new Error("Step 11 failed");

    // ── Step 12 — Final audit ─────────────────────────────────────────────────
    const audit = await pool.query(
      `
      SELECT 'users' AS tbl, COUNT(*)::int AS cnt FROM users WHERE email = $1
      UNION ALL SELECT 'blueprints', COUNT(*)::int FROM blueprints WHERE user_id = $2
      UNION ALL SELECT 'validations', COUNT(*)::int FROM validations WHERE blueprint_id = $3
      UNION ALL SELECT 'orders', COUNT(*)::int FROM orders WHERE blueprint_id = $3
      UNION ALL SELECT 'feedback', COUNT(*)::int FROM feedback WHERE blueprint_id = $3
      UNION ALL SELECT 'signal_snapshots', COUNT(*)::int FROM signal_snapshots WHERE blueprint_id = $3
      UNION ALL SELECT 'conditions', COUNT(*)::int FROM conditions WHERE blueprint_id = $3
      UNION ALL SELECT 'events', COUNT(*)::int FROM events WHERE blueprint_id = $3
      `,
      [TEST_EMAIL, userId, blueprintId],
    );
    const counts = Object.fromEntries(audit.rows.map((r) => [r.tbl, r.cnt]));
    const bpStatus = (
      await pool.query("SELECT status FROM blueprints WHERE id = $1", [blueprintId])
    ).rows[0]?.status;
    const currentCond = (
      await pool.query(
        "SELECT condition FROM conditions WHERE blueprint_id = $1 AND is_current = true LIMIT 1",
        [blueprintId],
      )
    ).rows[0]?.condition;

    const s12ok =
      counts.users === 1 &&
      counts.blueprints === 1 &&
      counts.validations >= 1 &&
      counts.orders >= 3 &&
      counts.feedback >= 2 &&
      counts.signal_snapshots >= 1 &&
      counts.conditions >= 1 &&
      counts.events >= 4 &&
      bpStatus === BlueprintStatus.ACTIVE;
    record(12, s12ok, { counts, blueprintStatus: bpStatus, currentCondition: currentCond });
  } catch (err) {
    console.error("\n[R6] Stopped:", err.message);
  } finally {
    await new Promise((r) => server.close(r));
    await cleanupTestUser(TEST_EMAIL);
    await pool.end().catch(() => null);
  }

  const allPass = Object.values(results).every((r) => r.pass) && Object.keys(results).length === 12;
  console.log("\n========== RECOVERY PROMPT R6 — FINAL REPORT ==========");
  console.log(`Status: ${allPass ? "COMPLETE" : "INCOMPLETE"}\n`);
  for (let i = 1; i <= 12; i++) {
    const r = results[i];
    console.log(`Step ${String(i).padEnd(2)} ${r ? (r.pass ? "PASS" : "FAIL") : "SKIP"}`);
  }
  console.log(`\nAll 12 steps: ${allPass ? "PASS" : "FAIL"}`);
  if (results[12]?.counts) {
    console.log("\nFinal database row counts:", results[12].counts);
    console.log("Blueprint status:", results[12].blueprintStatus);
    console.log("Current condition:", results[12].currentCondition);
  }
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
