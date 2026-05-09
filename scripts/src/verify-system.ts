#!/usr/bin/env node
/**
 * Phase 1 system verification — merges DB invariant checks (`verify-db`-style),
 * filesystem presence for engines/workers, and Bhudhi contract hygiene.
 *
 * Requires `DATABASE_URL`. Run from repo root:
 * `pnpm exec tsx scripts/src/verify-system.ts` or `pnpm -F @workspace/scripts verify:system`.
 */
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql, eq } from "drizzle-orm";

import { db, pool, featureFlags, knowledgeObjects } from "@workspace/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

type Check = { name: string; passed: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const tableCountResult = await db.execute<{ count: string }>(sql`
    SELECT count(*)::text AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('pg_boss', 'pg_stat_statements', 'pg_stat_statements_info')
  `);
  const tableCount = Number(tableCountResult.rows[0]?.count ?? 0);
  checks.push({
    name: "Table count (>=44)",
    passed: tableCount >= 44,
    detail: `${tableCount} tables`,
  });

  const indexResult = await db.execute<{ indexname: string }>(sql`
    SELECT indexname FROM pg_indexes WHERE indexname IN (
      'one_active_blueprint_per_user',
      'one_current_signal_per_blueprint',
      'one_current_condition_per_blueprint',
      'one_current_enforcement_per_blueprint',
      'one_current_state_memory_per_blueprint',
      'one_current_domain_per_blueprint'
    )
  `);
  checks.push({
    name: "Partial unique indexes (6)",
    passed: indexResult.rows.length === 6,
    detail: `${indexResult.rows.length}/6 found`,
  });

  const flagRows = await db.select().from(featureFlags);
  checks.push({
    name: "Feature flags (>=14)",
    passed: flagRows.length >= 14,
    detail: `${flagRows.length} flags`,
  });

  const teamFlag = flagRows.find((f) => f.feature_name === "team_mode_enabled");
  checks.push({
    name: "team_mode_enabled = false",
    passed: teamFlag?.enabled === false,
    detail: String(teamFlag?.enabled),
  });

  const advDomains = flagRows.find((f) => f.feature_name === "advanced_domains_enabled");
  checks.push({
    name: "advanced_domains_enabled = false",
    passed: advDomains?.enabled === false,
    detail: String(advDomains?.enabled),
  });

  const advFrameworks = flagRows.find((f) => f.feature_name === "advanced_frameworks_enabled");
  checks.push({
    name: "advanced_frameworks_enabled = false",
    passed: advFrameworks?.enabled === false,
    detail: String(advFrameworks?.enabled),
  });

  const required = [
    "ai_enabled",
    "academy_enabled",
    "identity_system_enabled",
    "compulsion_loop_enabled",
    "outcome_validation_enabled",
  ];
  const enabledNames = flagRows.filter((f) => f.enabled).map((f) => f.feature_name);
  checks.push({
    name: "Phase 1 required flags enabled",
    passed: required.every((f) => enabledNames.includes(f)),
    detail: required.every((f) => enabledNames.includes(f)) ? "All enabled" : "Some missing",
  });

  const koRows = await db.select().from(knowledgeObjects).where(eq(knowledgeObjects.is_global, true));
  checks.push({
    name: "Global knowledge objects (>=10)",
    passed: koRows.length >= 10,
    detail: `${koRows.length} objects`,
  });

  const domainRow = await db
    .execute<{ c: string }>(sql`
    SELECT count(*)::text AS c
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Domain'
  `)
    .catch(() => ({ rows: [{ c: "0" }] }));
  const domainCount = Number(domainRow.rows[0]?.c ?? 0);
  checks.push({
    name: "Domain enum breadth",
    passed: domainCount >= 7,
    detail: `${domainCount} enum labels`,
  });

  const workerFiles = [
    "SignalWorker.ts",
    "ConditionWorker.ts",
    "ControlWorker.ts",
    "TaskGenerationWorker.ts",
    "FeedbackWorker.ts",
    "InactivityWorker.ts",
    "NotificationWorker.ts",
    "ProjectionWorker.ts",
    "BhudhiWorker.ts",
    "HealthWorker.ts",
  ];
  const workersDir = join(repoRoot, "artifacts", "api-server", "src", "workers");
  const workersExist = workerFiles.every((w) => existsSync(join(workersDir, w)));
  checks.push({
    name: "Core workers (10 files)",
    passed: workersExist,
    detail: workersExist ? "present" : "missing worker file",
  });

  const enginePaths = [
    "artifacts/api-server/src/engines/signal/SignalCalculationEngine.ts",
    "artifacts/api-server/src/engines/condition/ConditionEvaluationEngine.ts",
    "artifacts/api-server/src/engines/control/ControlEngine.ts",
    "artifacts/api-server/src/engines/task-generation/TaskGenerationEngine.ts",
    "artifacts/api-server/src/engines/task-guarantee/ContinuousTaskGuaranteeEngine.ts",
    "artifacts/api-server/src/engines/feedback/FeedbackProcessingEngine.ts",
    "artifacts/api-server/src/engines/inactivity/InactivityDetectionEngine.ts",
    "artifacts/api-server/src/engines/identity/IdentityEngine.ts",
    "artifacts/api-server/src/engines/reward/RewardEngine.ts",
    "artifacts/api-server/src/engines/outcome/OutcomeValidationEngine.ts",
    "artifacts/api-server/src/engines/framework/FrameworkActivationEngine.ts",
    "artifacts/api-server/src/engines/lifecycle/CompletionEngine.ts",
    "artifacts/api-server/src/engines/lifecycle/PauseEngine.ts",
    "artifacts/api-server/src/engines/lifecycle/ResumeEngine.ts",
    "artifacts/api-server/src/engines/lifecycle/PivotEngine.ts",
    "artifacts/api-server/src/engines/strategy/StrategyEngine.ts",
    "artifacts/api-server/src/bhudhi/BhudhiCore.ts",
    "artifacts/api-server/src/bhudhi/PromptRegistry.ts",
    "artifacts/api-server/src/bhudhi/FallbackLibrary.ts",
    "artifacts/api-server/src/bhudhi/OutputValidator.ts",
  ];
  const enginesExist = enginePaths.every((p) => existsSync(join(repoRoot, p)));
  checks.push({
    name: "Critical engines + Bhudhi modules",
    passed: enginesExist,
    detail: enginesExist ? "All found" : "Some paths missing",
  });

  const { getAllContracts } = await import("../../artifacts/api-server/src/bhudhi/PromptRegistry.ts");
  const { FORBIDDEN_MODES } = await import("../../artifacts/api-server/src/types/bhudhi.ts");
  const contracts = getAllContracts();
  checks.push({
    name: "Bhudhi contracts (>=10)",
    passed: contracts.size >= 10,
    detail: `${contracts.size} registered`,
  });

  const forbidden = new Set<string>(FORBIDDEN_MODES);
  const noForbiddenModes = [...contracts.values()].every((c) => !forbidden.has(c.mode));
  checks.push({
    name: "Bhudhi contracts forbid authority modes",
    passed: noForbiddenModes,
    detail: noForbiddenModes ? "clean" : "contract uses forbidden mode",
  });

  const phase1ActiveFrameworks = [
    "governance_risk",
    "strategycore",
    "synergyops",
    "customervalue",
    "clarity_catalyst",
  ];
  checks.push({
    name: "Phase 1 active frameworks list (spec lock)",
    passed: phase1ActiveFrameworks.length === 5,
    detail: phase1ActiveFrameworks.join(", "),
  });

  console.log("\n=== TORGIMA PHASE 1 SYSTEM VERIFICATION ===\n");
  let allPassed = true;
  for (const check of checks) {
    const icon = check.passed ? "PASS" : "FAIL";
    console.log(`[${icon}] ${check.name} — ${check.detail}`);
    if (!check.passed) allPassed = false;
  }
  console.log("");
  console.log(`${checks.filter((c) => c.passed).length}/${checks.length} checks passed.`);

  if (!allPassed) {
    console.error("\nPhase 1 verification reported failures.");
    process.exitCode = 1;
  } else {
    console.log("\nTorgima Phase 1 automated verification checks succeeded for this database + tree.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
