import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimit, isRateLimitingEnabled } from "../../../monitoring/rateLimiter.js";
import { BHUDHI_API_ROUTES } from "../../../bhudhi/api/BhudhiCatalogService.js";

vi.mock("@workspace/db", () => ({
  pool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("SELECT 1") || sql === "SELECT 1") {
        return { rows: [{}] };
      }
      if (sql.includes("bhudhi_kernel_events")) return { rows: [{ c: "3" }] };
      if (sql.includes("bhudhi_memory_nodes")) return { rows: [{ c: "10" }] };
      if (sql.includes("bhudhi_unified_execution")) return { rows: [{ c: "2" }] };
      if (sql.includes("bhudhi_systems")) return { rows: [{ c: "5" }] };
      if (sql.includes("pgboss")) return { rows: [{ job_table: "pgboss.job" }] };
      if (sql.includes("bhudhi_unified_execution_results")) {
        return { rows: [{ total: "4", ok: "3" }] };
      }
      return { rows: [{ c: "0" }] };
    }),
  },
}));

vi.mock("../../../routes/health.js", () => ({
  checkDatabaseConnection: vi.fn(async () => undefined),
  checkPgBossWorkers: vi.fn(async () => undefined),
  buildProductionHealthResponse: vi.fn(async () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: { database: "ok", bhudhi: "ok", workers: "ok", signals: "ok" },
    version: "test",
    metrics: {},
  })),
}));

describe("BHUDHI Prompt 37 — Production monitoring", () => {
  beforeEach(() => {
    process.env.ENABLE_RATE_LIMITING = "true";
    process.env.RATE_LIMIT_REQUESTS = "3";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    resetRateLimit("bhudhi:test");
  });

  it("registers monitoring routes in catalog", () => {
    const paths = BHUDHI_API_ROUTES.map((r) => r.path);
    expect(paths).toContain("/api/bhudhi/monitoring/health");
    expect(paths).toContain("/api/bhudhi/monitoring/metrics");
  });

  it("rate limiter blocks after threshold", async () => {
    expect(isRateLimitingEnabled()).toBe(true);
    expect(await checkRateLimit("bhudhi:test", 3, 60_000)).toBe(true);
    expect(await checkRateLimit("bhudhi:test", 3, 60_000)).toBe(true);
    expect(await checkRateLimit("bhudhi:test", 3, 60_000)).toBe(true);
    expect(await checkRateLimit("bhudhi:test", 3, 60_000)).toBe(false);
  });

  it("BhudhiHealthCheck returns structured status", async () => {
    const { bhudhiHealthCheck } = await import("../../../monitoring/healthCheck.js");
    const status = await bhudhiHealthCheck.check();
    expect(status.checks.database).toBe(true);
    expect(status.checks.eventBus).toBe(true);
    expect(status.checks.memory).toBe(true);
    expect(status.checks.execution).toBe(true);
    expect(["healthy", "degraded", "unhealthy"]).toContain(status.status);
  });

  it("collectBhudhiMetrics includes platform and bhudhi blocks", async () => {
    const { collectBhudhiMetrics } = await import("../../../monitoring/metricsCollector.js");
    const metrics = await collectBhudhiMetrics();
    expect(metrics.platform.health).toBeDefined();
    expect(metrics.platform.bhudhi).toBeDefined();
    expect(metrics.bhudhi.memoryNodes).toBe(10);
  });
});
