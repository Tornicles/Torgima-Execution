import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

const schemaSql = readFileSync(join(root, "migrations/0033_platform_upgrade_reset.sql"), "utf8");
const manualSql = readFileSync(
  join(root, "scripts/migrations/manual-20260604-platform-upgrade-migration.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(root, "scripts/migrations/rollback-20260604-platform-upgrade-migration.sql"),
  "utf8",
);
const appTsx = readFileSync(join(root, "artifacts/torgima/src/App.tsx"), "utf8");
const onboardingPage = readFileSync(join(root, "artifacts/torgima/src/pages/onboarding.tsx"), "utf8");
const upgradePage = readFileSync(join(root, "artifacts/torgima/src/pages/upgrade.tsx"), "utf8");
const upgradeGate = readFileSync(
  join(root, "artifacts/torgima/src/components/UpgradeGate.tsx"),
  "utf8",
);

describe("Platform upgrade schema migration 0033", () => {
  it("adds execution_state and first_login_after_upgrade to users", () => {
    expect(schemaSql).toMatch(/execution_state/i);
    expect(schemaSql).toMatch(/first_login_after_upgrade/i);
  });

  it("creates platform_upgrade_archive table", () => {
    expect(schemaSql).toMatch(/platform_upgrade_archive/i);
    expect(schemaSql).toMatch(/archived_by_upgrade/i);
  });

  it("creates platform_upgrade_migrations tracking table", () => {
    expect(schemaSql).toMatch(/platform_upgrade_migrations/i);
  });
});

describe("Platform upgrade data migration", () => {
  it("archives validations, blueprints, orders, plans, signal snapshots, milestones", () => {
    expect(manualSql).toMatch(/'validation', v\.id/);
    expect(manualSql).toMatch(/'blueprint', b\.id/);
    expect(manualSql).toMatch(/'order', o\.id/);
    expect(manualSql).toMatch(/'plan', p\.id/);
    expect(manualSql).toMatch(/'signal_snapshot', ss\.id/);
    expect(manualSql).toMatch(/'milestone', m\.id/);
  });

  it("resets users to RESET_REQUIRED without hard deletes", () => {
    expect(manualSql).toMatch(/execution_state = 'RESET_REQUIRED'/);
    expect(manualSql).toMatch(/onboarding_complete = false/);
    expect(manualSql).toMatch(/active_blueprint_id = null/);
    expect(manualSql).not.toMatch(/DELETE FROM users/i);
  });

  it("deactivates plans with skipped status", () => {
    expect(manualSql).toMatch(/UPDATE plans SET status = 'skipped'/);
  });

  it("is idempotent via migration tracking", () => {
    expect(manualSql).toMatch(/platform_upgrade_v1_20260604/);
    expect(manualSql).toMatch(/already_applied/);
  });
});

describe("Platform upgrade rollback", () => {
  it("restores user execution flags and removes migration record", () => {
    expect(rollbackSql).toMatch(/execution_state = 'NORMAL'/);
    expect(rollbackSql).toMatch(/DELETE FROM platform_upgrade_migrations/);
  });
});

describe("Platform upgrade frontend routing", () => {
  it("registers /upgrade route and UpgradeGate", () => {
    expect(appTsx).toMatch(/path="\/upgrade"/);
    expect(appTsx).toMatch(/UpgradeGate/);
  });

  it("onboarding page uses ErectorOnboardingRefinementFlow only", () => {
    expect(onboardingPage).toContain("ErectorOnboardingRefinementFlow");
    expect(onboardingPage).not.toContain("AlignedValidationResults");
    expect(onboardingPage).not.toContain("OnboardingShell");
  });

  it("upgrade page offers Start New Validation and archived data", () => {
    expect(upgradePage).toMatch(/Start New Validation/);
    expect(upgradePage).toMatch(/View Archived Data/);
    expect(upgradePage).toMatch(/Torgima has been upgraded/);
  });

  it("UpgradeGate allows onboarding and validation paths during reset", () => {
    expect(upgradeGate).toMatch(/\/upgrade/);
    expect(upgradeGate).toMatch(/\/validate/);
    expect(upgradeGate).toMatch(/RESET_REQUIRED/);
  });
});
