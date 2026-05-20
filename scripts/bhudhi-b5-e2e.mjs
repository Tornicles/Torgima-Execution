#!/usr/bin/env node
/**
 * Bhudhi B5 — end-to-end verification (9 triggers + memory + log audit).
 * Run: node scripts/bhudhi-b5-e2e.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const TEST_EMAIL = `bhudhi_verify_${Date.now()}@torgima.test`;
const TEST_USERNAME = `bhudhi_verify_${Date.now().toString(36).slice(-6)}`;

/** Canonical trigger → Postgres bhudhi_trigger_type enum */
const LOG_TRIGGER_MAP = {
  GOAL_STRUCTURING: "goal_structuring",
  TASK_DRAFTING: "task_generation",
  FEEDBACK_CLASSIFICATION: "blocker_classification",
  CLARIFICATION_PROMPT: "feedback_interrogation",
  RECOVERY_COPY: "condition_explanation",
  STATE_EXPLANATION: "state_explanation",
  ROOT_CAUSE_ASSIST: "root_cause_candidates",
  OUTCOME_EVIDENCE_SUMMARY: "evidence_summary",
  ACADEMY_SUPPORT: "academy_content",
};

const results = {};

function record(key, pass, detail = {}) {
  results[key] = { pass, ...detail };
  console.log(`\n[${key}] ${pass ? "PASS" : "FAIL"}`, detail.message ?? "", detail.error ?? "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function hasLog(pool, userId, canonicalTrigger) {
  const dbType = LOG_TRIGGER_MAP[canonicalTrigger];
  const r = await pool.query(
    `SELECT id, trigger_type, validation_status, fallback_used, token_count_in, latency_ms
     FROM bhudhi_logs WHERE user_id = $1 AND trigger_type = $2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, dbType],
  );
  return r.rows[0] ?? null;
}

async function ensureTask(blueprintId, userId, mode = "post_feedback") {
  const { guaranteeTask } = await import(
    "../artifacts/api-server/src/engines/task-guarantee/ContinuousTaskGuaranteeEngine.ts"
  );
  await guaranteeTask({
    blueprintId,
    userId,
    generationMode: mode,
    generationTrigger: "b5_verification",
  });
}

async function flushPipeline(blueprintId, userId) {
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
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required for B5 verification");
    process.exit(1);
  }

  const { pool } = await import("@workspace/db");
  const { default: app } = await import("../artifacts/api-server/src/app.ts");


  await pool.query(`
    CREATE TABLE IF NOT EXISTS failure_classifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      primary_candidate TEXT NOT NULL,
      primary_likelihood DOUBLE PRECISION NOT NULL,
      secondary_candidate TEXT,
      secondary_likelihood DOUBLE PRECISION,
      tertiary_candidate TEXT,
      tertiary_likelihood DOUBLE PRECISION,
      evidence_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
      system_action TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_failure_classifications_feedback ON failure_classifications(feedback_id);
  `).catch(() => null);

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  let userId;
  let token;
  let blueprintId;
  let validationId;
  let contractId;
  let orderId;

  const { resetStabilityStateForTests } = await import(
    "../artifacts/api-server/src/engines/stability/StabilityEngine.ts"
  );

  try {
    await jsonFetch(`${base}/api/auth/send-magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const userRow = await pool.query("SELECT id FROM users WHERE email = $1", [TEST_EMAIL]);
    userId = userRow.rows[0]?.id;
    await pool.query(
      "UPDATE users SET tier = 'growth', username = $2, mode = 'individual' WHERE id = $1",
      [userId, TEST_USERNAME],
    );
    await pool.query(
      `INSERT INTO feature_flags (feature_name, enabled, description)
       VALUES ('ai_enabled', true, 'B5 verification')
       ON CONFLICT (feature_name) DO UPDATE SET enabled = true`,
    ).catch(() =>
      pool.query("UPDATE feature_flags SET enabled = true WHERE feature_name = 'ai_enabled'"),
    );

    token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [userId, tokenHash],
    );
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // ── Trigger 1 — GOAL_STRUCTURING ─────────────────────────────────────────
    const t1 = await jsonFetch(`${base}/api/onboarding/goal`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        rawGoal: "I want to build something profitable in tech",
        purpose: "quit my job",
        timeframe: "soon",
        commitmentLevel: "high",
        selectedBlueprintTier: "growth",
        idempotencyKey: `b5-goal-${Date.now()}`,
      }),
    });
    blueprintId = t1.body?.data?.blueprintId;
    validationId = t1.body?.data?.validationId;
    contractId = t1.body?.data?.validationContractId;
    const valMeta = await pool.query(
      `SELECT id, contract_id, verdict FROM validations WHERE blueprint_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [blueprintId],
    );
    validationId = validationId ?? valMeta.rows[0]?.id;
    contractId = contractId ?? valMeta.rows[0]?.contract_id;
    const structured = t1.body?.data?.structured ?? {};
    const intelPayload = await pool.query(
      `SELECT intelligence_payload FROM validations WHERE blueprint_id = $1 AND validation_kind = 'intelligence' ORDER BY created_at DESC LIMIT 1`,
      [blueprintId],
    );
    const ip = intelPayload.rows[0]?.intelligence_payload ?? {};
    const log1 = await hasLog(pool, userId, "GOAL_STRUCTURING");
    const t1ok =
      t1.res.ok &&
      t1.body?.ok &&
      Boolean(structured.cleanedGoal ?? structured.suggestedClarifyingQuestion) &&
      (structured.ambiguityFlags?.length > 0 ||
        structured.missingRequiredFields?.length > 0 ||
        String(structured.cleanedGoal ?? "").length > 5) &&
      log1 &&
      ["success", "fallback", "error", "pending"].includes(log1.validation_status) &&
      (structured.ambiguityFlags?.length > 0 || structured.suggestedClarifyingQuestion);
    record("T1_GOAL_STRUCTURING", t1ok, {
      message: `ambiguity=${structured.ambiguityFlags?.length ?? 0} log=${log1?.trigger_type}/${log1?.validation_status}`,
      eisFields: {
        demand: ip.eis_demand_score,
        saturation: ip.eis_saturation_score,
        context: ip.eis_industry_context?.slice?.(0, 40),
      },
    });

    // Path selection + launch
    const verdict = t1.body?.data?.verdict ?? "proceed";
    const selectedPath = verdict === "adjust" ? "adjusted" : "current";
    await jsonFetch(`${base}/api/blueprints/${blueprintId}/configure-selection`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tier: "growth", mode: "individual" }),
    });
    if (validationId) {
      await jsonFetch(`${base}/api/validation/${validationId}/select-path`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ selectedPath, confirmAdjusted: verdict === "adjust" }),
      });
    }
    if (!contractId) {
      throw new Error("validation contract_id missing after onboarding");
    }
    const activate = await jsonFetch(`${base}/api/blueprints/${blueprintId}/activate`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        validationContractId: contractId,
        validation_contract_id: contractId,
        selectedPath: selectedPath,
        selected_path_type: selectedPath,
        selectedBlueprintLevel: "growth",
      }),
    });
    if (!activate.res.ok) {
      record("ACTIVATE", false, { message: activate.body?.error?.message ?? "activate failed" });
      throw new Error("Blueprint activate failed");
    }

    const { generate: generateTask } = await import(
      "../artifacts/api-server/src/engines/task-generation/TaskGenerationEngine.ts"
    );
    await generateTask({
      blueprintId,
      userId,
      generationMode: "initial",
      generationTrigger: "b5_task_drafting",
    }).catch(() => null);
    await sleep(800);

    // ── Trigger 2 — TASK_DRAFTING ───────────────────────────────────────────
    const active = await jsonFetch(`${base}/api/execution/active-order`, { headers: auth });
    orderId = active.body?.data?.order?.id;
    const orderRow = orderId
      ? await pool.query("SELECT title, instruction, why_it_matters FROM orders WHERE id = $1", [orderId])
      : { rows: [] };
    const log2 = await hasLog(pool, userId, "TASK_DRAFTING");
    const generic = "Complete your next execution step";
    const t2ok =
      Boolean(orderId) &&
      orderRow.rows[0]?.instruction &&
      !orderRow.rows[0]?.title?.includes(generic) &&
      orderRow.rows[0]?.why_it_matters &&
      log2;
    record("T2_TASK_DRAFTING", t2ok, {
      message: `order=${orderId} title=${orderRow.rows[0]?.title?.slice(0, 50)} log=${!!log2}`,
    });

    async function startActiveOrder() {
      const active = await jsonFetch(`${base}/api/execution/active-order`, { headers: auth });
      const oid = active.body?.data?.order?.id;
      if (!oid) return null;
      await jsonFetch(`${base}/api/orders/${oid}/start`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ idempotencyKey: `b5-start-${oid}-${Date.now()}` }),
      });
      return oid;
    }

    // ── Trigger 4 — CLARIFICATION_PROMPT (proof required, none supplied) ───
    if (orderId) {
      await pool.query("UPDATE orders SET proof_required = true WHERE id = $1", [orderId]);
      await jsonFetch(`${base}/api/orders/${orderId}/start`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ idempotencyKey: `b5-start-t4-${orderId}` }),
      });
    }
    const t4 = await jsonFetch(`${base}/api/orders/${orderId}/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        completionStatus: "completed",
        score: 7,
        reflection: "Completed work but forgot proof attachment this cycle.",
        idempotencyKey: `b5-clarify-${orderId}`,
      }),
    });
    const log4 = await hasLog(pool, userId, "CLARIFICATION_PROMPT");
    const t4ok =
      t4.body?.data?.requiresInterrogation === true &&
      Boolean(t4.body?.data?.interrogationQuestion) &&
      log4;
    record("T4_CLARIFICATION_PROMPT", t4ok, {
      message: `question=${t4.body?.data?.interrogationQuestion?.slice(0, 40)} log=${!!log4}`,
    });

    // Complete same order with proof (T8) — order still active after clarification early-return
    await jsonFetch(`${base}/api/orders/${orderId}/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        completionStatus: "completed",
        score: 8,
        reflection:
          "I published the article at medium.com/example and received two replies from target readers confirming interest.",
        proofJson: { text: "I published the article at medium.com/example-post-for-bhudhi-verify" },
        idempotencyKey: `b5-proof-${orderId}`,
      }),
    });
    await flushPipeline(blueprintId, userId);

    // ── Trigger 3 — FEEDBACK_CLASSIFICATION (critic on new order) ───────────
    await ensureTask(blueprintId, userId);
    const criticOrderId = await startActiveOrder();
    resetStabilityStateForTests();

    const t3 = await jsonFetch(`${base}/api/orders/${criticOrderId}/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        completionStatus: "completed",
        score: 9,
        reflection: "Did it. OK.",
        idempotencyKey: `b5-critic-${criticOrderId}`,
      }),
    });
    const fbCritic = await pool.query(
      `SELECT interrogation_json FROM feedback WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [criticOrderId],
    );
    const interrogation = fbCritic.rows[0]?.interrogation_json;
    const log3 = await hasLog(pool, userId, "FEEDBACK_CLASSIFICATION");
    const log3Alt = await pool.query(
      `SELECT id FROM bhudhi_logs WHERE user_id = $1 AND trigger_type = 'blocker_classification'
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const t3ok =
      (t3.body?.data?.requiresInterrogation === true ||
        interrogation?.requires_interrogation === true) &&
      Boolean(interrogation?.question ?? t3.body?.data?.interrogationQuestion) &&
      (log3 || log3Alt.rowCount > 0);
    record("T3_FEEDBACK_CLASSIFICATION", t3ok, {
      message: `interrogation=${Boolean(interrogation?.question ?? t3.body?.data?.interrogationQuestion)} log=${!!log3}`,
    });

    // ── Trigger 8 — OUTCOME_EVIDENCE_SUMMARY ─────────────────────────────────
    const fbProof = await pool.query(
      `SELECT proof_json FROM feedback WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orderId],
    );
    const proofJson = fbProof.rows[0]?.proof_json ?? {};
    const log8 = await hasLog(pool, userId, "OUTCOME_EVIDENCE_SUMMARY");
    const t8ok =
      Boolean(proofJson.outcomeEvidenceSummary || proofJson.text?.length > 10) && log8;
    record("T8_OUTCOME_EVIDENCE_SUMMARY", t8ok, {
      message: `summary=${String(proofJson.outcomeEvidenceSummary ?? "").slice(0, 50)} log=${!!log8}`,
    });

    // ── Trigger 6 — STATE_EXPLANATION (dashboard) ───────────────────────────
    const t6 = await jsonFetch(`${base}/api/state/dashboard`, { headers: auth });
    const intel = t6.body?.data?.intelligence;
    const log6 = await hasLog(pool, userId, "STATE_EXPLANATION");
    const t6ok =
      t6.res.ok &&
      intel?.headline &&
      intel.headline.length > 3 &&
      typeof intel.fallbackUsed === "boolean" &&
      (log6 || intel.fallbackUsed === true);
    record("T6_STATE_EXPLANATION", t6ok, {
      message: `headline=${intel?.headline?.slice(0, 50)} fallback=${intel?.fallbackUsed} log=${!!log6}`,
    });

    // ── Trigger 5 + 7 — failed feedback → recovery + root cause ─────────────
    await ensureTask(blueprintId, userId);
    const active2 = await jsonFetch(`${base}/api/execution/active-order`, { headers: auth });
    let failOrderId = active2.body?.data?.order?.id;
    if (failOrderId) {
      await jsonFetch(`${base}/api/orders/${failOrderId}/start`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ idempotencyKey: `b5-fail-start-${failOrderId}` }),
      });
    }
    const failFb = await jsonFetch(`${base}/api/orders/${failOrderId}/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        completionStatus: "failed",
        score: 2,
        reflection:
          "I don't know how to complete this because I do not have access to the required deployment tool for this task.",
        blockerJson: { blocker_type: "tool_access", had_blocker: true },
        idempotencyKey: `b5-fail-${failOrderId}`,
      }),
    });
    await flushPipeline(blueprintId, userId);
    resetStabilityStateForTests();
    await generateTask({
      blueprintId,
      userId,
      generationMode: "recovery",
      generationTrigger: "recovery_triggered",
    }).catch(() => null);
    await sleep(800);

    const recoveryOrder = await pool.query(
      `SELECT id, task_type, instruction FROM orders WHERE blueprint_id = $1 AND task_type = 'recovery'
       ORDER BY created_at DESC LIMIT 1`,
      [blueprintId],
    );
    const log5 = await hasLog(pool, userId, "RECOVERY_COPY");
    const recoveryInstr = recoveryOrder.rows[0]?.instruction ?? "";
    const t5ok =
      recoveryOrder.rows[0]?.task_type === "recovery" &&
      Boolean(recoveryInstr?.trim()) &&
      log5;
    record("T5_RECOVERY_COPY", t5ok, {
      message: `task_type=${recoveryOrder.rows[0]?.task_type} instr_len=${recoveryInstr.length} log=${!!log5}`,
    });

    // ── Trigger 9 — ACADEMY_SUPPORT (capability gap → academy task) ────────
    await pool.query(
      `INSERT INTO skill_profiles (user_id, domain, skill_scores, detected_gaps)
       VALUES ($1, 'Content', '{"content_ideation": 0.1}'::jsonb, '["content_ideation"]'::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET skill_scores = '{"content_ideation": 0.1}'::jsonb`,
      [userId],
    ).catch(() => null);

    await ensureTask(blueprintId, userId);
    const academyOrderId = await startActiveOrder();
    if (academyOrderId) {
      await pool.query(
        "UPDATE orders SET difficulty = 'very_hard' WHERE id = $1",
        [academyOrderId],
      );
    }
    await jsonFetch(`${base}/api/orders/${academyOrderId}/feedback`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        completionStatus: "failed",
        score: 3,
        reflection:
          "I don't know how to complete this step — it felt very hard and I lacked the core skill to execute.",
        frictionScore: 5,
        confidenceScore: 1,
        idempotencyKey: `b5-academy-${academyOrderId}`,
      }),
    });
    await flushPipeline(blueprintId, userId);
    const { routeCapabilityGapToAcademy } = await import(
      "../artifacts/api-server/src/engines/academy/AcademyOrchestrator.ts"
    );
    await routeCapabilityGapToAcademy({
      userId,
      blueprintId,
      orderId: academyOrderId,
      failureCategory: "CAPABILITY_GAP",
      reflection:
        "I don't know how to complete this step — it felt very hard and I lacked the core skill to execute.",
    }).catch(() => null);
    await generateTask({
      blueprintId,
      userId,
      generationMode: "post_feedback",
      generationTrigger: "academy_gap_detected",
    }).catch(() => null);
    await sleep(800);

    const academyOrder = await pool.query(
      `SELECT task_type, instruction FROM orders WHERE blueprint_id = $1 AND task_type = 'academy' ORDER BY created_at DESC LIMIT 1`,
      [blueprintId],
    );
    const log9 = await hasLog(pool, userId, "ACADEMY_SUPPORT");
    const t9ok =
      academyOrder.rowCount > 0 &&
      academyOrder.rows[0]?.instruction?.length > 30 &&
      log9;
    record("T9_ACADEMY_SUPPORT", t9ok, {
      message: `task_type=${academyOrder.rows[0]?.task_type} log=${!!log9}`,
    });

    // ── Trigger 7 — ROOT_CAUSE_ASSIST (after academy fail path) ─────────────
    await sleep(500);
    const log7 = await hasLog(pool, userId, "ROOT_CAUSE_ASSIST");
    const fc = await pool.query(
      `SELECT primary_candidate FROM failure_classifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const t7ok =
      fc.rowCount >= 1 &&
      fc.rows[0]?.primary_candidate &&
      fc.rows[0].primary_candidate !== "unknown" &&
      log7;
    record("T7_ROOT_CAUSE_ASSIST", t7ok, {
      message: `primary=${fc.rows[0]?.primary_candidate} log=${!!log7}`,
    });

    // ── Memory verification ─────────────────────────────────────────────────
    const mem = await pool.query(
      `SELECT memory_type, scope, length(content) AS len, source_type
       FROM bhudhi_memory WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );
    const types = mem.rows.map((r) => r.memory_type);
    const memOk =
      mem.rowCount >= 3 &&
      (types.includes("FRICTION_PATTERN") || types.includes("EXECUTION_PATTERN")) &&
      types.includes("RECOVERY_CONTEXT") &&
      mem.rows.every((r) => Number(r.len) <= 503);
    record("MEMORY", memOk, { message: `rows=${mem.rowCount} types=${types.join(",")}` });

    // ── BhudhiLog audit ─────────────────────────────────────────────────────
    const audit = await pool.query(
      `SELECT trigger_type,
              validation_status AS status,
              COUNT(*)::int AS calls,
              AVG(latency_ms)::int AS avg_latency_ms,
              SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END)::int AS fallback_count
       FROM bhudhi_logs WHERE user_id = $1
       GROUP BY trigger_type, validation_status ORDER BY trigger_type`,
      [userId],
    );
    const totalLogs = await pool.query(
      `SELECT COUNT(*)::int AS cnt,
              SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END)::int AS fb,
              AVG(latency_ms)::int AS avg_ms
       FROM bhudhi_logs WHERE user_id = $1`,
      [userId],
    );
    const requiredDbTypes = Object.values(LOG_TRIGGER_MAP);
    const seen = new Set(audit.rows.map((r) => r.trigger_type));
    const auditOk = requiredDbTypes.every((t) => seen.has(t));
    const missingTypes = requiredDbTypes.filter((t) => !seen.has(t));
    record("LOG_AUDIT", auditOk, {
      message: `types=${[...seen].join(",")} missing=${missingTypes.join(",") || "none"} total=${totalLogs.rows[0]?.cnt}`,
      audit: audit.rows,
    });

    const total = totalLogs.rows[0]?.cnt ?? 0;
    const fb = totalLogs.rows[0]?.fb ?? 0;
    const avgMs = totalLogs.rows[0]?.avg_ms ?? 0;
    const fallbackPct = total > 0 ? Math.round((fb / total) * 100) : 0;

    console.log("\n========== BHUDHI B5 SUMMARY ==========");
    for (const [k, v] of Object.entries(results)) {
      console.log(`${k}: ${v.pass ? "PASS" : "FAIL"}`);
    }
    console.log(`Total BhudhiLog rows: ${total}`);
    console.log(`Fallback rate: ${fallbackPct}%`);
    console.log(`Average latency ms: ${avgMs}`);
    console.log("======================================\n");

    const allPass = Object.values(results).every((r) => r.pass);
    process.exit(allPass ? 0 : 1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    server.close();
    await pool.end().catch(() => null);
  }
}

main();
