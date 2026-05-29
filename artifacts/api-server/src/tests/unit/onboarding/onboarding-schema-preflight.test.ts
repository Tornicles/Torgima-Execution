import { describe, it, expect, vi, beforeEach } from "vitest";

const poolQuery = vi.fn();

vi.mock("@workspace/db", () => ({
  pool: { query: poolQuery },
}));

describe("onboarding goal schema preflight", () => {
  beforeEach(() => {
    vi.resetModules();
    poolQuery.mockReset();
  });

  async function loadVerifySchema() {
    return import("../../../lib/verifySchema.js");
  }

  function mockTableExists(tables: string[]) {
    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("information_schema.tables")) {
        const name = params?.[0] as string;
        return { rowCount: tables.includes(name) ? 1 : 0 };
      }
      if (sql.includes("information_schema.columns")) {
        return { rowCount: 1 };
      }
      return { rowCount: 0 };
    });
  }

  function mockAllColumnsPresent() {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("information_schema")) return { rowCount: 1 };
      return { rowCount: 0 };
    });
  }

  it("checkOnboardingGoalSchemaHealth does not require blueprint_tier", async () => {
    mockAllColumnsPresent();
    const { checkOnboardingGoalSchemaHealth, checkSchemaHealth } = await loadVerifySchema();

    const onboarding = await checkOnboardingGoalSchemaHealth();
    expect(onboarding.ok).toBe(true);

    poolQuery.mockReset();
    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("information_schema.tables")) return { rowCount: 1 };
      if (sql.includes("information_schema.columns")) {
        const col = params?.[1] as string;
        if (col === "blueprint_tier") return { rowCount: 0 };
        return { rowCount: 1 };
      }
      return { rowCount: 0 };
    });

    const extended = await checkSchemaHealth();
    expect(extended.ok).toBe(false);
    expect(extended.missing.some((m) => m.includes("blueprint_tier"))).toBe(true);

    const onboardingAgain = await checkOnboardingGoalSchemaHealth();
    expect(onboardingAgain.ok).toBe(true);
  });

  it("fails when intelligence validation columns are missing", async () => {
    mockTableExists(["users", "blueprints", "validations"]);
    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("information_schema.tables")) {
        const name = params?.[0] as string;
        return { rowCount: ["users", "blueprints", "validations"].includes(name) ? 1 : 0 };
      }
      if (sql.includes("information_schema.columns")) {
        const col = params?.[1] as string;
        if (col === "selected_path") return { rowCount: 0 };
        return { rowCount: 1 };
      }
      return { rowCount: 0 };
    });

    const { checkOnboardingGoalSchemaHealth } = await loadVerifySchema();
    const health = await checkOnboardingGoalSchemaHealth();
    expect(health.ok).toBe(false);
    expect(health.missing.some((m) => m.includes("validations.selected_path"))).toBe(true);
  });
});
