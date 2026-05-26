import { describe, it, expect } from "vitest";
import {
  BHUDHI_SYSTEMS,
  BHUDHI_ENGINES,
  BHUDHI_FRAMEWORKS,
  BHUDHI_DOMAINS,
} from "@workspace/db/bhudhi-seed-data";

describe("BHUDHI PROMPT 1 catalog seed data", () => {
  it("defines 5 systems", () => {
    expect(BHUDHI_SYSTEMS).toHaveLength(5);
    expect(BHUDHI_SYSTEMS.map((s) => s.id).sort()).toEqual([
      "intelligence",
      "investigation",
      "operating",
      "preservation",
      "security",
    ]);
  });

  it("defines 40+ engines with valid system FKs", () => {
    expect(BHUDHI_ENGINES.length).toBeGreaterThanOrEqual(40);
    const systemIds = new Set(BHUDHI_SYSTEMS.map((s) => s.id));
    for (const engine of BHUDHI_ENGINES) {
      expect(systemIds.has(engine.systemId)).toBe(true);
    }
    expect(BHUDHI_ENGINES.filter((e) => e.systemId === "investigation")).toHaveLength(13);
    expect(BHUDHI_ENGINES.filter((e) => e.systemId === "intelligence")).toHaveLength(12);
    expect(BHUDHI_ENGINES.filter((e) => e.systemId === "operating")).toHaveLength(10);
    expect(BHUDHI_ENGINES.filter((e) => e.systemId === "security")).toHaveLength(5);
    expect(BHUDHI_ENGINES.filter((e) => e.systemId === "preservation")).toHaveLength(7);
  });

  it("defines 14 team frameworks + 1 individual", () => {
    expect(BHUDHI_FRAMEWORKS).toHaveLength(15);
    const team = BHUDHI_FRAMEWORKS.filter((f) => f.type === "team");
    const individual = BHUDHI_FRAMEWORKS.filter((f) => f.type === "individual");
    expect(team).toHaveLength(14);
    expect(individual).toHaveLength(1);
    expect(individual[0]?.id).toBe("individual_mastery");
  });

  it("defines 7 domains with framework roles", () => {
    expect(BHUDHI_DOMAINS).toHaveLength(7);
    expect(BHUDHI_DOMAINS.map((d) => d.id).sort()).toEqual([
      "continuity",
      "delivery",
      "genesis",
      "growth",
      "market",
      "operations",
      "people",
    ]);
    for (const domain of BHUDHI_DOMAINS) {
      expect(Object.keys(domain.frameworkRoles).length).toBeGreaterThan(0);
    }
  });
});
