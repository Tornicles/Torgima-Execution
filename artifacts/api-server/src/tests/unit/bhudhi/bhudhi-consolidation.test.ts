import { describe, it, expect } from "vitest";
import { BHUDHI_API_ROUTES } from "../../../bhudhi/api/BhudhiCatalogService.js";

describe("BHUDHI Phase 2 — Consolidation routes", () => {
  const paths = BHUDHI_API_ROUTES.map((r) => r.path);

  it("registers kernel routes (Prompt 31)", () => {
    expect(paths).toContain("/api/bhudhi/kernel/cycle");
    expect(paths).toContain("/api/bhudhi/kernel/context");
  });

  it("registers memory graph routes (Prompt 32)", () => {
    expect(paths).toContain("/api/bhudhi/memory/query");
    expect(paths).toContain("/api/bhudhi/memory/stats");
  });

  it("registers protocol routes (Prompt 33)", () => {
    expect(paths).toContain("/api/bhudhi/protocol/send");
    expect(paths).toContain("/api/bhudhi/protocol/history");
  });

  it("registers execution runtime routes (Prompt 35)", () => {
    expect(paths).toContain("/api/bhudhi/runtime/execute");
    expect(paths).toContain("/api/bhudhi/execution/stats");
  });

  it("registers consolidation status (Phase 2 manifest)", () => {
    expect(paths).toContain("/api/bhudhi/consolidation/status");
  });

  it("registers monitoring routes (Prompt 37)", () => {
    expect(paths).toContain("/api/bhudhi/monitoring/health");
    expect(paths).toContain("/api/bhudhi/monitoring/metrics");
  });

  it("registers certification route (Prompt 38)", () => {
    expect(paths).toContain("/api/bhudhi/certification");
  });

  it("registers launch routes (Prompt 40)", () => {
    expect(paths).toContain("/api/bhudhi/launch/status");
    expect(paths).toContain("/api/bhudhi/launch/config");
    expect(paths).toContain("/api/telemetry");
  });

  it("registers civilization routes (Prompt 29)", () => {
    expect(paths).toContain("/api/bhudhi/civilizations");
    expect(paths).toContain("/api/bhudhi/civilization/create");
    expect(paths).toContain("/api/bhudhi/civilization/simulate-years");
  });

  it("registers expansion routes (Prompt 30)", () => {
    expect(paths).toContain("/api/bhudhi/expansion/status");
    expect(paths).toContain("/api/bhudhi/expansion/discover");
    expect(paths).toContain("/api/bhudhi/expansion/approve");
  });
});
