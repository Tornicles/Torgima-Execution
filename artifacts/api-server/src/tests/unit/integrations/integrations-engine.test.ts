import { describe, it, expect } from "vitest";
import {
  eventsOverlap,
  evaluateAutomationConditions,
  signWebhookPayload,
  INTEGRATION_TYPES,
} from "../../../engines/integrations/IntegrationsEngine.js";
import { FEATURE_FLAGS, isFeatureEnabledByDefault } from "../../../constants/feature-flags.js";

describe("eventsOverlap", () => {
  it("detects overlapping intervals", () => {
    const a = { start: new Date("2026-05-01T10:00:00Z"), end: new Date("2026-05-01T11:00:00Z") };
    const b = { start: new Date("2026-05-01T10:30:00Z"), end: new Date("2026-05-01T12:00:00Z") };
    expect(eventsOverlap(a, b)).toBe(true);
  });

  it("returns false for adjacent non-overlapping intervals", () => {
    const a = { start: new Date("2026-05-01T10:00:00Z"), end: new Date("2026-05-01T11:00:00Z") };
    const b = { start: new Date("2026-05-01T11:00:00Z"), end: new Date("2026-05-01T12:00:00Z") };
    expect(eventsOverlap(a, b)).toBe(false);
  });
});

describe("evaluateAutomationConditions", () => {
  it("requires minScore when configured", () => {
    expect(evaluateAutomationConditions({ minScore: 80 }, { score: 90 })).toBe(true);
    expect(evaluateAutomationConditions({ minScore: 80 }, { score: 70 })).toBe(false);
  });

  it("requires minStreak when configured", () => {
    expect(evaluateAutomationConditions({ minStreak: 7 }, { streak: 10 })).toBe(true);
    expect(evaluateAutomationConditions({ minStreak: 7 }, { streak: 3 })).toBe(false);
  });
});

describe("signWebhookPayload", () => {
  it("produces stable HMAC hex", () => {
    const a = signWebhookPayload("secret", '{"a":1}');
    const b = signWebhookPayload("secret", '{"a":1}');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("integration catalog", () => {
  it("lists supported providers", () => {
    expect(INTEGRATION_TYPES).toContain("google-calendar");
    expect(INTEGRATION_TYPES).toContain("slack");
    expect(INTEGRATION_TYPES).toContain("linkedin");
  });
});

describe("feature flag", () => {
  it("external_integrations_enabled defaults on in phase 1", () => {
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.EXTERNAL_INTEGRATIONS_ENABLED)).toBe(true);
  });
});

describe("verifyWebhookSignature", () => {
  it("verifies HMAC signature", () => {
    const secret = "test-secret";
    const body = '{"event":"order-completed"}';
    const sig = signWebhookPayload(secret, body);
    expect(sig).toBe(signWebhookPayload(secret, body));
    expect(sig).not.toBe(signWebhookPayload("other", body));
  });
});
