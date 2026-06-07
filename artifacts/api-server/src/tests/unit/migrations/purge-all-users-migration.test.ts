import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

const migrationSql = readFileSync(join(root, "migrations/0035_purge_all_user_accounts.sql"), "utf8");
const manualSql = readFileSync(
  join(root, "scripts/migrations/manual-20260527-purge-all-user-accounts.sql"),
  "utf8",
);

describe("Purge all user accounts migration 0035", () => {
  it("hard-deletes all users and clears active blueprint pointers", () => {
    expect(migrationSql).toMatch(/DELETE FROM users/i);
    expect(migrationSql).toMatch(/active_blueprint_id = NULL/i);
    expect(migrationSql).toMatch(/signal_snapshots SET causation_event_id = NULL/i);
    expect(migrationSql).toMatch(/DELETE FROM events/i);
    expect(migrationSql).toMatch(/purge_all_users_v1_20260527/);
  });

  it("clears blueprint FK blockers before deleting users", () => {
    expect(migrationSql).toMatch(/DELETE FROM system_health_logs WHERE blueprint_id IS NOT NULL/i);
    expect(migrationSql).toMatch(/DELETE FROM behavior_patterns WHERE blueprint_id IS NOT NULL/i);
    expect(migrationSql).toMatch(/DELETE FROM bhudhi_memory WHERE blueprint_id IS NOT NULL/i);
    expect(migrationSql).toMatch(/DELETE FROM capability_profiles WHERE blueprint_id IS NOT NULL/i);
    expect(migrationSql).toMatch(/DELETE FROM eis_call_logs WHERE blueprint_id IS NOT NULL/i);
    expect(migrationSql).toMatch(/DELETE FROM knowledge_objects WHERE blueprint_id IS NOT NULL/i);
    expect(migrationSql).toMatch(/DELETE FROM notification_logs WHERE blueprint_id IS NOT NULL/i);
    expect(migrationSql).toMatch(/behavior_events SET pattern_id = NULL/i);
    expect(migrationSql).toMatch(/academy_tasks SET knowledge_id = NULL/i);

    const usersDeleteIndex = migrationSql.search(/DELETE FROM users/i);
    const healthLogsDeleteIndex = migrationSql.search(
      /DELETE FROM system_health_logs WHERE blueprint_id IS NOT NULL/i,
    );
    expect(healthLogsDeleteIndex).toBeGreaterThan(-1);
    expect(usersDeleteIndex).toBeGreaterThan(healthLogsDeleteIndex);
  });

  it("is idempotent via platform_upgrade_migrations", () => {
    expect(migrationSql).toMatch(/already_applied/);
    expect(migrationSql).toMatch(/rollback_available.*false/i);
  });

  it("manual script mirrors drizzle migration", () => {
    expect(manualSql).toMatch(/DELETE FROM users/i);
    expect(manualSql).toMatch(/DELETE FROM events/i);
    expect(manualSql).toMatch(/purge_all_users_v1_20260527/);
  });
});
