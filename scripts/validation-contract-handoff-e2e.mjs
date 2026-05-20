#!/usr/bin/env node
/**
 * Validation contract handoff — onboarding goal → activate.
 * Run: pnpm -F @workspace/api-server exec tsx ../../scripts/validation-contract-handoff-e2e.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

const TEST_EMAIL = `contract_handoff_${Date.now()}@torgima.test`;

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  const { pool } = await import("@workspace/db");
  const { default: app } = await import("../artifacts/api-server/src/app.ts");

  const uidRes = await pool.query("SELECT id FROM users WHERE email = $1", [TEST_EMAIL]);
  const uid = uidRes.rows[0]?.id;
  if (uid) {
    const bps = await pool.query("SELECT id FROM blueprints WHERE user_id = $1", [uid]);
    for (const bp of bps.rows) {
      await pool.query("DELETE FROM events WHERE blueprint_id = $1", [bp.id]);
    }
    await pool.query("DELETE FROM users WHERE id = $1", [uid]);
  }

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await jsonFetch(`${base}/api/auth/send-magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const userRows = await pool.query("SELECT id FROM users WHERE email = $1", [TEST_EMAIL]);
    const userId = userRows.rows[0]?.id;
    if (!userId) throw new Error("test user not created");

    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [userId, tokenHash],
    );

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const goal = await jsonFetch(`${base}/api/onboarding/goal`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        rawGoal: "Build a project management app for founders",
        purpose: "To streamline team execution",
        timeframe: "3 months",
        commitmentLevel: "high",
        currentContext: "Solo founder with technical background",
        successSignal: "10 paying teams in 90 days",
        idempotencyKey: `handoff-${Date.now()}`,
        tier: "starter",
        mode: "individual",
      }),
    });

    const contractId = goal.body?.data?.validationContractId;
    const blueprintId = goal.body?.data?.blueprintId;
    const validationId = goal.body?.data?.validationId;

    console.log("onboarding/goal status:", goal.res.status);
    console.log("validationContractId:", contractId ?? "(missing)");
    console.log("blueprintId:", blueprintId ?? "(missing)");

    if (!contractId) {
      console.error("FAIL: validationContractId missing from onboarding/goal response");
      process.exit(1);
    }

    await jsonFetch(`${base}/api/blueprints/${blueprintId}/configure-selection`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tier: "starter", mode: "individual" }),
    });

    if (validationId) {
      await jsonFetch(`${base}/api/validation/${validationId}/select-path`, {
        method: "POST",
        headers,
        body: JSON.stringify({ selectedPath: "current" }),
      });
    }

    const activate = await jsonFetch(`${base}/api/blueprints/${blueprintId}/activate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        validationContractId: contractId,
        validation_contract_id: contractId,
        selectedPath: "current",
        selected_path_type: "current",
        selectedBlueprintLevel: "starter",
      }),
    });

    console.log("activate status:", activate.res.status, activate.body?.ok ? "ok" : activate.body?.error);
    if (!activate.body?.ok) {
      console.error("FAIL: activate", activate.body?.error?.message);
      process.exit(1);
    }

    console.log("PASS: validation contract handoff (goal → activate)");
  } finally {
    server.close();
    await pool.end().catch(() => null);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
