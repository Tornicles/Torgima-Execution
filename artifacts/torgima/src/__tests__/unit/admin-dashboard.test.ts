import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const torgimaRoot = resolve(import.meta.dirname, "../../..");
const apiRoot = resolve(torgimaRoot, "../api-server");
const repoRoot = resolve(torgimaRoot, "../..");
const readApi = (p: string) => readFileSync(resolve(apiRoot, p), "utf8");
const readTorgima = (p: string) => readFileSync(resolve(torgimaRoot, p), "utf8");

describe("TORGIMA Super Admin Dashboard", () => {
  it("defines admin database tables and migration", () => {
    expect(readFileSync(resolve(repoRoot, "lib/db/migrations/20260602140000_admin_tables.sql"), "utf8")).toContain(
      "admin_sessions",
    );
    expect(readFileSync(resolve(repoRoot, "lib/db/src/schema/adminTables.ts"), "utf8")).toContain(
      "admin_actions_log",
    );
  });

  it("mounts isolated /api/admin routes with session auth", () => {
    expect(readApi("src/app.ts")).toContain('"/api/admin"');
    expect(readApi("src/routes/admin.ts")).toContain("requireAdminAuth");
    expect(readApi("src/services/AdminAuthService.ts")).toContain("ADMIN_SESSION_COOKIE");
  });

  it("provides admin React app at /admin", () => {
    expect(readTorgima("src/App.tsx")).toContain("/admin");
    expect(readTorgima("src/admin/AdminApp.tsx")).toContain("AdminSidebar");
    expect(readTorgima("src/admin/pages/AdminDashboard.tsx")).toContain("60_000");
  });

  it("logs support interventions to admin_actions_log", () => {
    expect(readApi("src/services/adminActionLog.ts")).toContain("adminActionsLog");
    expect(readApi("src/routes/admin.ts")).toContain("logAdminAction");
  });
});
