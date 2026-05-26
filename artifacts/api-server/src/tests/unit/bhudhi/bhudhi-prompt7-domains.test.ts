import { describe, it, expect } from "vitest";
import { DOMAIN_CATALOG } from "../../../bhudhi/domains/domainCatalog.js";
import {
  resolveDomainFromEventCount,
  getDomainDescription,
  getDomainConditions,
  DOMAIN_CONDITIONS,
} from "../../../bhudhi/domains/domainLogic.js";
import { domainsService } from "../../../bhudhi/domains/DomainsService.js";

describe("BHUDHI PROMPT 7 — Domains", () => {
  it("catalog defines all 7 domains", () => {
    expect(DOMAIN_CATALOG).toHaveLength(7);
    const names = DOMAIN_CATALOG.map((d) => d.name);
    expect(names).toEqual([
      "genesis",
      "market",
      "delivery",
      "operations",
      "growth",
      "continuity",
      "people",
    ]);
  });

  it("assigns framework roles (lead/veto/advise) per domain", () => {
    for (const domain of DOMAIN_CATALOG) {
      expect(domain.activeFrameworks.length).toBeGreaterThan(0);
      for (const fw of domain.activeFrameworks) {
        const role = domain.frameworkRoles[fw];
        expect(["lead", "veto", "advise"]).toContain(role);
      }
    }
  });

  it("genesis domain has 5 active frameworks", () => {
    const genesis = DOMAIN_CATALOG.find((d) => d.id === "genesis")!;
    expect(genesis.activeFrameworks).toHaveLength(5);
    expect(genesis.frameworkRoles.CLARITY_CATALYST).toBe("lead");
    expect(genesis.frameworkRoles.ALIGNMENT_ACCOUNTABILITY).toBe("veto");
  });

  it("continuity domain leads with REGENERATION_EXIT and ADAPTIVE_INTELLIGENCE", () => {
    const continuity = DOMAIN_CATALOG.find((d) => d.id === "continuity")!;
    expect(continuity.frameworkRoles.REGENERATION_EXIT).toBe("lead");
    expect(continuity.frameworkRoles.ADAPTIVE_INTELLIGENCE).toBe("lead");
    expect(continuity.activeFrameworks).toContain("GOVERNANCE_RISK");
  });

  it("resolves domain from execution event count thresholds", () => {
    expect(resolveDomainFromEventCount(0)).toBe("genesis");
    expect(resolveDomainFromEventCount(3)).toBe("genesis");
    expect(resolveDomainFromEventCount(10)).toBe("market");
    expect(resolveDomainFromEventCount(25)).toBe("delivery");
    expect(resolveDomainFromEventCount(60)).toBe("operations");
    expect(resolveDomainFromEventCount(100)).toBe("growth");
    expect(resolveDomainFromEventCount(200)).toBe("growth");
  });

  it("routes high-maturity blueprints to continuity on danger/urgency signals", () => {
    expect(resolveDomainFromEventCount(200, "danger")).toBe("continuity");
    expect(resolveDomainFromEventCount(200, "urgency")).toBe("continuity");
    expect(resolveDomainFromEventCount(200, "stable")).toBe("growth");
  });

  it("exposes domain descriptions and entry/exit conditions", () => {
    expect(getDomainDescription("genesis")).toContain("validation");
    expect(getDomainConditions("market").exit).toContain("Market fit");
    expect(DOMAIN_CONDITIONS.people.frameworks).toBe(6);
    expect(domainsService.getDomainConditions("growth").frameworks).toBe(7);
  });

  it("listDomains returns summary for each domain", () => {
    const list = domainsService.listDomains();
    expect(list).toHaveLength(7);
    expect(list.find((d) => d.id === "delivery")?.frameworkCount).toBe(7);
  });
});
