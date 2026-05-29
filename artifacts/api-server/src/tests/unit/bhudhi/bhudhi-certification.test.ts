import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  pool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("to_regclass")) {
        const table = sql.match(/'([^']+)'/)?.[1] ?? "";
        const known = [
          "bhudhi_kernel_events",
          "bhudhi_memory_nodes",
          "bhudhi_protocol_messages",
          "bhudhi_unified_execution_contexts",
        ];
        return { rows: [{ reg: known.includes(table) ? table : null }] };
      }
      if (sql.includes("bhudhi_kernel_events") && sql.includes("failed")) {
        return { rows: [{ c: "0" }] };
      }
      if (sql.includes("bhudhi_kernel_events")) return { rows: [{ c: "100" }] };
      if (sql.includes("bhudhi_unified_execution_contexts")) return { rows: [{ c: "10" }] };
      if (sql.includes("bhudhi_unified_execution_results") && sql.includes("success")) {
        return { rows: [{ c: "9" }] };
      }
      if (sql.includes("bhudhi_protocol_messages") && sql.includes("AVG")) {
        return { rows: [{ avg: "42" }] };
      }
      if (sql.includes("bhudhi_memory_nodes")) return { rows: [{ c: "500" }] };
      if (sql.includes("bhudhi_systems")) return { rows: [{ c: "5" }] };
      return { rows: [{ c: "0" }] };
    }),
  },
}));

vi.mock("../../../monitoring/healthCheck.js", () => ({
  bhudhiHealthCheck: {
    check: vi.fn().mockResolvedValue({
      status: "healthy",
      checks: { database: true },
      latencies: {},
      counts: {},
      errors: [],
    }),
  },
}));

describe("BHUDHI Prompt 38 — Certification", () => {
  beforeEach(() => {
    process.env.INTERNAL_AUTH_SECRET = "test-secret-min-32-characters-long";
    process.env.LOG_LEVEL = "info";
    process.env.ENABLE_RATE_LIMITING = "true";
    process.env.NODE_ENV = "test";
  });

  it("calculates BRS with category and scores", async () => {
    const { bhudhiCertification } = await import("../../../monitoring/certification.js");
    const result = await bhudhiCertification.calculate();

    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(["not-ready", "partial", "production", "enterprise"]).toContain(result.category);
    expect(result.scores.length).toBe(6);
    expect(result.brsLabel).toBeTruthy();
    expect(result.nextSteps.length).toBeGreaterThan(0);
  });

  it("maps enterprise tier at high scores", async () => {
    const { BhudhiCertification } = await import("../../../monitoring/certification.js");
    const cert = new BhudhiCertification();
    const spy = vi.spyOn(cert as any, "assessReliability").mockResolvedValue({
      category: "Reliability",
      score: 100,
      weight: 0.22,
      criteria: [{ name: "x", passed: true, score: 100 }],
    });
    vi.spyOn(cert as any, "assessPerformance").mockResolvedValue({
      category: "Performance",
      score: 100,
      weight: 0.18,
      criteria: [{ name: "x", passed: true, score: 100 }],
    });
    vi.spyOn(cert as any, "assessSecurity").mockResolvedValue({
      category: "Security",
      score: 100,
      weight: 0.2,
      criteria: [{ name: "x", passed: true, score: 100 }],
    });
    vi.spyOn(cert as any, "assessOperational").mockResolvedValue({
      category: "Operational",
      score: 100,
      weight: 0.18,
      criteria: [{ name: "x", passed: true, score: 100 }],
    });
    vi.spyOn(cert as any, "assessScalability").mockResolvedValue({
      category: "Scalability",
      score: 100,
      weight: 0.12,
      criteria: [{ name: "x", passed: true, score: 100 }],
    });
    vi.spyOn(cert as any, "assessConsolidation").mockResolvedValue({
      category: "Consolidation",
      score: 100,
      weight: 0.1,
      criteria: [{ name: "x", passed: true, score: 100 }],
    });

    const result = await cert.calculate();
    expect(result.overall).toBeGreaterThanOrEqual(85);
    expect(result.category).toBe("enterprise");
    spy.mockRestore();
  });
});
