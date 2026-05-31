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
    expect(migrationSql).toMatch(/purge_all_users_v1_20260527/);
  });

  it("is idempotent via platform_upgrade_migrations", () => {
    expect(migrationSql).toMatch(/already_applied/);
    expect(migrationSql).toMatch(/rollback_available.*false/i);
  });

  it("manual script mirrors drizzle migration", () => {
    expect(manualSql).toMatch(/DELETE FROM users/i);
    expect(manualSql).toMatch(/purge_all_users_v1_20260527/);
  });
});
