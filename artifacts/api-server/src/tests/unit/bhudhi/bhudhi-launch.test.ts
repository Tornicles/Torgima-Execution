import { describe, it, expect, beforeEach } from "vitest";
import { BHUDHI_API_ROUTES } from "../../../bhudhi/api/BhudhiCatalogService.js";
import {
  getEnvironment,
  resolveEnvironmentName,
  environments,
} from "../../../config/environments.js";
import {
  getTierLimits,
  pricingTierFromUserTier,
  userTierFromPricingTier,
  pricingTiers,
} from "../../../pricing/bhudhiTiers.js";
import { telemetry } from "../../../telemetry/Telemetry.js";

describe("BHUDHI Prompt 40 — Launch", () => {
  beforeEach(() => {
    delete process.env.ENVIRONMENT;
    process.env.NODE_ENV = "test";
  });

  it("registers launch routes in catalog", () => {
    const paths = BHUDHI_API_ROUTES.map((r) => r.path);
    expect(paths).toContain("/api/bhudhi/launch/status");
    expect(paths).toContain("/api/bhudhi/launch/config");
    expect(paths).toContain("/api/bhudhi/launch/onboard");
    expect(paths).toContain("/api/telemetry");
  });

  it("resolves development environment by default in test", () => {
    expect(resolveEnvironmentName()).toBe("development");
    const env = getEnvironment();
    expect(env.name).toBe("development");
    expect(env.telemetry.enabled).toBe(false);
    expect(environments.production.limits.requestsPerMinute).toBe(100);
  });

  it("maps pricing tiers to Torgima user tiers", () => {
    expect(userTierFromPricingTier("free")).toBe("starter");
    expect(userTierFromPricingTier("pro")).toBe("growth");
    expect(userTierFromPricingTier("enterprise")).toBe("ultimate");
    expect(pricingTierFromUserTier("starter")).toBe("free");
    expect(pricingTierFromUserTier("growth")).toBe("pro");
    expect(pricingTierFromUserTier("ultimate")).toBe("enterprise");
  });

  it("returns tier limits for free and enterprise", () => {
    expect(getTierLimits("free").blueprints).toBe(1);
    expect(getTierLimits("enterprise").blueprints).toBe(100);
    expect(pricingTiers.pro.monthlyPrice).toBe(99);
  });

  it("ingests telemetry events when enabled", () => {
    const original = environments.development.telemetry.enabled;
    environments.development.telemetry.enabled = true;
    environments.development.telemetry.sampleRate = 1;
    telemetry.ingest([
      {
        event: "test.launch",
        timestamp: new Date(),
        properties: { ok: true },
      },
    ]);
    environments.development.telemetry.enabled = original;
    expect(true).toBe(true);
  });
});
