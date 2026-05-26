import { describe, it, expect } from "vitest";
import { buildBhudhiPayload, BHUDHI_NEXT_STEPS } from "../../../bhudhi/api/bhudhiApiEnvelope.js";
import { BHUDHI_API_ROUTES } from "../../../bhudhi/api/BhudhiCatalogService.js";

describe("BHUDHI PROMPT 10 — API routes", () => {
  it("builds standardized envelope with insight, nextSteps, confidence, reasoning", () => {
    const body = buildBhudhiPayload({
      success: true,
      count: 3,
      insight: "Test insight",
      nextSteps: ["step-a", "step-b"],
      confidence: 0.91,
      reasoning: "Because metrics improved",
    });

    expect(body.success).toBe(true);
    expect(body.count).toBe(3);
    expect(body.insight).toBe("Test insight");
    expect(body.nextSteps).toEqual(["step-a", "step-b"]);
    expect(body.confidence).toBe(0.91);
    expect(body.reasoning).toBe("Because metrics improved");
  });

  it("defines at least 15 canonical API routes", () => {
    expect(BHUDHI_API_ROUTES.length).toBeGreaterThanOrEqual(15);
    const paths = BHUDHI_API_ROUTES.map((r) => r.path);
    expect(paths).toContain("/api/bhudhi/investigate");
    expect(paths).toContain("/api/bhudhi/recommend");
    expect(paths).toContain("/api/bhudhi/execute");
    expect(paths).toContain("/api/bhudhi/health");
    expect(paths).toContain("/api/bhudhi/status");
    expect(paths).toContain("/api/bhudhi/insights");
  });

  it("covers Prompt 10 summary methods", () => {
    const methods = new Set(BHUDHI_API_ROUTES.map((r) => `${r.method} ${r.path}`));
    expect(methods.has("POST /api/bhudhi/investigate")).toBe(true);
    expect(methods.has("GET /api/bhudhi/signals")).toBe(true);
    expect(methods.has("POST /api/bhudhi/signals")).toBe(true);
    expect(methods.has("GET /api/bhudhi/external/connections")).toBe(true);
  });

  it("documents next-step chains for core flows", () => {
    expect(BHUDHI_NEXT_STEPS.investigate.length).toBeGreaterThan(0);
    expect(BHUDHI_NEXT_STEPS.recommend.some((s) => s.includes("execute"))).toBe(true);
    expect(BHUDHI_NEXT_STEPS.execute[0]).toContain("track-outcome");
  });
});
