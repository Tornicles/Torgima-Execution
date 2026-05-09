import { db, pool } from "./index.js";
import { featureFlags, users, knowledgeObjects } from "./schema/index.js";
import { sql, eq, inArray } from "drizzle-orm";

async function verify() {
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  // 1. Table count
  const tableCountResult = await db.execute<{ count: string }>(sql`
    SELECT count(*)::text as count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name != 'pg_boss'
  `);
  const tableCount = Number(tableCountResult.rows[0]?.count ?? 0);
  checks.push({
    name: "Table count",
    passed: tableCount >= 44,
    detail: `Found ${tableCount} tables (expected >= 44)`,
  });

  // 2. Partial indexes
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
    name: "Partial indexes",
    passed: indexResult.rows.length === 6,
    detail: `Found ${indexResult.rows.length} partial indexes (expected 6)`,
  });

  // 3. Feature flag count
  const flagRows = await db.select().from(featureFlags);
  checks.push({
    name: "Feature flags",
    passed: flagRows.length >= 14,
    detail: `Found ${flagRows.length} feature flags (expected >= 14)`,
  });

  // 4. Phase 1 flags enabled
  const requiredEnabled = ["ai_enabled", "academy_enabled", "identity_system_enabled", "compulsion_loop_enabled", "outcome_validation_enabled"];
  const enabledRows = flagRows.filter((f) => f.enabled);
  const allEnabled = requiredEnabled.every((name) => enabledRows.some((f) => f.feature_name === name));
  checks.push({
    name: "Required Phase 1 flags enabled",
    passed: allEnabled,
    detail: allEnabled ? "All required Phase 1 flags are enabled" : "Some required flags are disabled",
  });

  // 5. Phase 2 flags disabled
  const shouldBeDisabled = ["team_mode_enabled", "advanced_domains_enabled", "advanced_frameworks_enabled"];
  const disabledRows = flagRows.filter((f) => !f.enabled);
  const allDisabled = shouldBeDisabled.every((name) => disabledRows.some((f) => f.feature_name === name));
  checks.push({
    name: "Phase 2 flags disabled",
    passed: allDisabled,
    detail: allDisabled ? "All Phase 2 flags correctly disabled" : "Some Phase 2 flags are incorrectly enabled",
  });

  // 6. Updated_at triggers
  const triggerResult = await db.execute<{ trigger_name: string }>(sql`
    SELECT trigger_name FROM information_schema.triggers
    WHERE trigger_name LIKE 'trg_%_updated_at'
  `);
  checks.push({
    name: "Updated_at triggers",
    passed: triggerResult.rows.length >= 11,
    detail: `Found ${triggerResult.rows.length} triggers (expected >= 11)`,
  });

  // 7. Dev users
  const devEmails = ["dev@torgima.com", "test-starter@torgima.com", "test-ultimate@torgima.com"];
  const devUserRows = await db.select().from(users).where(inArray(users.email, devEmails));
  checks.push({
    name: "Dev users",
    passed: devUserRows.length === 3,
    detail: `Found ${devUserRows.length} dev users (expected 3)`,
  });

  // 8. Global knowledge objects
  const koRows = await db.select().from(knowledgeObjects).where(eq(knowledgeObjects.is_global, true));
  checks.push({
    name: "Global knowledge objects",
    passed: koRows.length >= 10,
    detail: `Found ${koRows.length} global knowledge objects (expected >= 10)`,
  });

  // Print results
  let allPassed = true;
  for (const check of checks) {
    const icon = check.passed ? "PASS" : "FAIL";
    console.log(`[${icon}] ${check.name}: ${check.detail}`);
    if (!check.passed) allPassed = false;
  }

  if (allPassed) {
    console.log("\nAll checks passed. Database is ready for Prompt 3.");
  } else {
    console.error("\nSome checks failed. Resolve before moving to Prompt 3.");
    process.exit(1);
  }
}

verify()
  .catch(console.error)
  .finally(() => pool.end());
