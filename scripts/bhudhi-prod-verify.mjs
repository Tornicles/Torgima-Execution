#!/usr/bin/env node
/**
 * Production-safe Bhudhi runtime verification — no secrets printed.
 * Usage: TORGIMA_PROD_CONFIRM=1 pnpm bhudhi:prod:verify
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectProductionWithFallback,
  getFeatureFlags,
  hasVerifyConfirm,
  loadProductionEnv,
  printProductionTargetSummary,
} from "./db-prod-common.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiSrc = join(root, "artifacts", "api-server", "src");
const API_BASE = process.env.VITE_API_BASE_URL?.trim() || "https://api.torgima.com";

if (!hasVerifyConfirm()) {
  console.error("Bhudhi prod verify requires TORGIMA_PROD_CONFIRM=1 or --confirm.");
  process.exit(1);
}

loadProductionEnv();
printProductionTargetSummary();

const results = [];
const pass = (name, detail = "") => {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
};
const fail = (name, detail = "") => {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log("Bhudhi Production Verify");
console.log("");

// 1. Provider env presence (never print value)
const providerConfigured = Boolean(
  process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY?.trim(),
);
if (providerConfigured) pass("Provider API key configured in local env");
else fail("Provider API key configured in local env", "missing ANTHROPIC_API_KEY");

// 2. DB feature flags
let client;
try {
  const conn = await connectProductionWithFallback();
  client = conn.client;
  pass("Database reachable for flag inspection");
} catch (err) {
  fail("Database reachable for flag inspection", err instanceof Error ? err.message : String(err));
}

if (client) {
  const flags = await getFeatureFlags(client);
  const forceFallbacks = flags.find((f) => f.feature_name === "bhudhi_force_fallbacks");
  const degraded = flags.find((f) => f.feature_name === "degraded_mode");
  const aiEnabled = flags.find((f) => f.feature_name === "ai_enabled");

  if (forceFallbacks && !forceFallbacks.enabled) pass("bhudhi_force_fallbacks is false");
  else fail("bhudhi_force_fallbacks is false", `enabled=${forceFallbacks?.enabled ?? "missing"}`);

  if (degraded && !degraded.enabled) pass("degraded_mode is false");
  else fail("degraded_mode is false", `enabled=${degraded?.enabled ?? "missing"}`);

  if (aiEnabled?.enabled !== false) pass("ai_enabled is on");
  else fail("ai_enabled is on");

  try {
    const r = await client.query(`SELECT COUNT(*)::int AS c FROM bhudhi_logs`);
    pass("bhudhi_logs table readable", `rows=${r.rows[0]?.c ?? 0}`);
  } catch (err) {
    fail("bhudhi_logs table readable", err instanceof Error ? err.message : String(err));
  }

  try {
    const last = await client.query(
      `SELECT validation_status, created_at FROM bhudhi_logs ORDER BY created_at DESC LIMIT 1`,
    );
    pass("Last Bhudhi log readable", last.rows[0]?.validation_status ?? "none");
  } catch (err) {
    fail("Last Bhudhi log readable", err instanceof Error ? err.message : String(err));
  }

  await client.end().catch(() => undefined);
}

// 3. Direct Anthropic call audit
function walkTs(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "tests" || entry === "node_modules") continue;
      walkTs(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

const allowed = new Set([
  join(apiSrc, "lib", "bhudhi", "ProviderAdapter.ts"),
  join(apiSrc, "bhudhi", "BhudhiCore.ts"),
]);

const leaks = [];
for (const file of walkTs(apiSrc)) {
  const text = readFileSync(file, "utf8");
  if (
    (text.includes("new Anthropic") || text.includes("messages.create")) &&
    !allowed.has(file)
  ) {
    leaks.push(file.replace(root + "\\", "").replace(root + "/", ""));
  }
}

if (leaks.length === 0) pass("No direct Anthropic SDK calls outside Bhudhi adapter");
else fail("No direct Anthropic SDK calls outside Bhudhi adapter", leaks.join(", "));

// 4. Canonical trigger registry source check
const registrySrc = readFileSync(join(apiSrc, "lib", "bhudhi", "TriggerRegistry.ts"), "utf8");
const required = [
  "ERECTOR_FREE_VALIDATION",
  "ERECTOR_PAID_VALIDATION",
  "ERECTOR_FREE_VERDICT_EXPLAIN",
  "ERECTOR_VERDICT_EXPLAIN",
];
const missingTriggers = required.filter((t) => !registrySrc.includes(t));
if (missingTriggers.length === 0) pass("Erector triggers present in canonical registry");
else fail("Erector triggers present in canonical registry", missingTriggers.join(", "));

// 5. Live API debug endpoint (if deployed)
try {
  const res = await fetch(`${API_BASE}/api/debug/bhudhi-runtime`, {
    headers: { "x-internal-auth": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (res.status === 404) {
    fail("Live /api/debug/bhudhi-runtime", "404 — redeploy Worker with Prompt 3 changes");
  } else if (res.ok) {
    const body = await res.json();
    const data = body.data ?? body;
    if (data.erector_triggers_registered) pass("Live bhudhi-runtime endpoint", "erector triggers OK");
    else fail("Live bhudhi-runtime endpoint", JSON.stringify(data));
  } else {
    fail("Live /api/debug/bhudhi-runtime", `HTTP ${res.status}`);
  }
} catch (err) {
  fail("Live /api/debug/bhudhi-runtime", err instanceof Error ? err.message : String(err));
}

// 6. Unit smoke subset
try {
  execSync(
    "pnpm -F @workspace/api-server exec vitest run src/tests/unit/bhudhi/bhudhi-smoke.test.ts",
    { cwd: root, stdio: "pipe" },
  );
  pass("Bhudhi unit smoke tests");
} catch {
  fail("Bhudhi unit smoke tests");
}

console.log("");
const failed = results.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log("Bhudhi prod verify: PASS");
  process.exit(0);
}
console.log(`Bhudhi prod verify: FAIL (${failed.length} checks)`);
process.exit(1);
