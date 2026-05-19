import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env") });
dotenv.config({ path: join(repoRoot, "artifacts/api-server/.env") });
process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const { db, pool } = await import("./index.js");
const { featureFlags, users, knowledgeObjects } = await import("./schema/index.js");
const { sql, eq, inArray } = await import("drizzle-orm");

async function verify() {
  const checks: { name: string; passed: boolean; detail: string }[] = [];

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

  const flagRows = await db.select().from(featureFlags);
  checks.push({
    name: "Feature flags",
    passed: flagRows.length >= 14,
    detail: `Found ${flagRows.length} feature flags (expected >= 14)`,
  });

  const requiredEnabled = ["ai_enabled", "academy_enabled", "identity_system_enabled", "compulsion_loop_enabled", "outcome_validation_enabled"];
  const enabledRows = flagRows.filter((f) => f.enabled);
  const allEnabled = requiredEnabled.every((name) => enabledRows.some((f) => f.feature_name === name));
  checks.push({
    name: "Required Phase 1 flags enabled",
    passed: allEnabled,
    detail: allEnabled ? "All required Phase 1 flags are enabled" : "Some required flags are disabled",
  });

  const shouldBeDisabled = ["team_mode_enabled", "advanced_domains_enabled", "advanced_frameworks_enabled"];
  const disabledRows = flagRows.filter((f) => !f.enabled);
  const allDisabled = shouldBeDisabled.every((name) => disabledRows.some((f) => f.feature_name === name));
  checks.push({
    name: "Phase 2 flags disabled",
    passed: allDisabled,
    detail: allDisabled ? "All Phase 2 flags correctly disabled" : "Some Phase 2 flags are incorrectly enabled",
  });

  const triggerResult = await db.execute<{ trigger_name: string }>(sql`
    SELECT trigger_name FROM information_schema.triggers
    WHERE trigger_name LIKE 'trg_%_updated_at'
  `);
  checks.push({
    name: "Updated_at triggers",
    passed: triggerResult.rows.length >= 11,
    detail: `Found ${triggerResult.rows.length} triggers (expected >= 11)`,
  });

  const devEmails = ["dev@torgima.com", "test-starter@torgima.com", "test-ultimate@torgima.com"];
  const devUserRows = await db.select().from(users).where(inArray(users.email, devEmails));
  checks.push({
    name: "Dev users",
    passed: devUserRows.length === 3,
    detail: `Found ${devUserRows.length} dev users (expected 3)`,
  });

  const koRows = await db.select().from(knowledgeObjects).where(eq(knowledgeObjects.is_global, true));
  checks.push({
    name: "Global knowledge objects",
    passed: koRows.length >= 10,
    detail: `Found ${koRows.length} global knowledge objects (expected >= 10)`,
  });

  const orphanOrders = await db.execute<{ count: string }>(sql`
    SELECT count(*)::text AS count
    FROM orders o
    LEFT JOIN actions a ON a.id = o.action_id
    WHERE o.action_id IS NOT NULL AND a.id IS NULL
  `);
  const orphanCount = Number(orphanOrders.rows[0]?.count ?? 0);
  checks.push({
    name: "Orders without actions",
    passed: orphanCount === 0,
    detail: `${orphanCount} orphan orders`,
  });

  const activeEmpty = await db.execute<{ count: string }>(sql`
    SELECT count(*)::text AS count
    FROM blueprints b
    WHERE b.active = true AND b.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.blueprint_id = b.id AND o.status IN ('pending', 'active')
      )
  `);
  const emptyActive = Number(activeEmpty.rows[0]?.count ?? 0);
  checks.push({
    name: "Active blueprints without pending orders",
    passed: emptyActive === 0,
    detail: `${emptyActive} active blueprints with empty queue`,
  });

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
