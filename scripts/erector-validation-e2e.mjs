#!/usr/bin/env node
/** Erector validation — seed, run, verify DB population. */
import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

const TEST_EMAIL = `erector_e2e_${Date.now()}@torgima.test`;

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  const { pool } = await import("@workspace/db");
  const { default: app } = await import("../artifacts/api-server/src/app.ts");
  const { seedEconomicArchetypes } = await import("../artifacts/api-server/src/engines/erector/seedArchetypes.ts");

  const seeded = await seedEconomicArchetypes();
  const archetypeCount = await pool.query("SELECT COUNT(*)::int AS n FROM economic_archetypes");
  console.log("Archetypes seeded this run:", seeded, "| DB count:", archetypeCount.rows[0].n);

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
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [userId, tokenHash],
    );
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const bpRes = await jsonFetch(`${base}/api/onboarding/goal`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        rawGoal: "Start a USA Zimbabwe shipping company for SME exporters",
        purpose: "Reliable cross-border logistics with proof-based trust",
        timeframe: "90 days",
        commitmentLevel: "high",
        idempotencyKey: `erector-bp-${Date.now()}`,
        tier: "starter",
        mode: "individual",
      }),
    });
    const blueprintId = bpRes.body?.data?.blueprintId;
    if (!blueprintId) throw new Error("onboarding goal missing blueprintId");

    const erector = await jsonFetch(`${base}/api/v1/validation/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        blueprintId,
        idempotencyKey: `erector-run-${Date.now()}`,
        rawGoal: "Start a USA Zimbabwe shipping company for SME exporters",
        purpose: "Reliable cross-border logistics with proof-based trust",
        timeframe: "90d",
        commitmentLevel: "HIGH",
        desiredOutcome: "First 10 paying exporter clients",
        location: { country: "Nigeria", city: "Lagos" },
        businessType: "hybrid",
        businessModel: "B2B logistics brokerage",
        budgetAvailable: 50000,
        currency: "USD",
        currentResources: ["Network", "Operations experience"],
        targetCustomer: "SME exporters needing USA-Zimbabwe lanes",
      }),
    });

    if (!erector.body?.ok) throw new Error(erector.body?.error?.message ?? "Erector run failed");
    const validationId = erector.body.data?.validationId;
    console.log("Erector API verdict:", erector.body.data?.verdict, "reality:", erector.body.data?.scores?.realityScore);

    const row = await pool.query(
      `SELECT verdict, reality_score, market_score, execution_score, timing_score,
              economy_briefing, industry_intelligence, market_analysis, winner_analysis,
              path_current, path_adjusted, path_alternative, intelligence_payload
       FROM validations WHERE id = $1`,
      [validationId],
    );
    const v = row.rows[0];
    const checks = {
      verdict: v?.verdict != null,
      reality_score: v?.reality_score != null,
      market_score: v?.market_score != null,
      economy_briefing: v?.economy_briefing != null,
      industry_intelligence: v?.industry_intelligence != null,
      market_analysis: v?.market_analysis != null,
      path_current: v?.path_current != null,
      path_adjusted: v?.path_adjusted != null,
      path_alternative: v?.path_alternative != null,
    };
    console.log("DB population:", checks);
    const briefingLen = JSON.stringify(v?.economy_briefing ?? "").length;
    console.log("economy_briefing JSON length:", briefingLen);

    const maps = await pool.query(
      "SELECT COUNT(*)::int AS n FROM validation_archetype_maps WHERE validation_id = $1",
      [validationId],
    );
    console.log("validation_archetype_maps:", maps.rows[0].n);

    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (failed.length) {
      console.error("FAIL missing:", failed.join(", "));
      process.exit(1);
    }
    console.log("PASS: Erector validation E2E");
  } finally {
    server.close();
    await pool.end().catch(() => null);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
