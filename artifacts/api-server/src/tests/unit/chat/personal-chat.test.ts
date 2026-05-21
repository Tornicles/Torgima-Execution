/**
 * PROMPT 4 — Chat blocker detection & notification flags.
 */

import { describe, it, expect } from "vitest";
import { detectBlocker, detectSentiment } from "../../../engines/chat/PersonalChatEngine.js";
import { FEATURE_FLAGS, isFeatureEnabledByDefault } from "../../../constants/feature-flags.js";

describe("Blocker detection", () => {
  it("detects dependency blockers", () => {
    const r = detectBlocker("Still waiting on approval from legal before I can ship");
    expect(r.isBlocker).toBe(true);
    expect(r.blockerType).toBe("dependency");
  });

  it("detects high severity with urgent markers", () => {
    const r = detectBlocker("URGENT — blocked by missing API key!!");
    expect(r.isBlocker).toBe(true);
    expect(r.severity).toBeGreaterThanOrEqual(4);
  });

  it("ignores neutral updates", () => {
    const r = detectBlocker("Shipped the landing page update today");
    expect(r.isBlocker).toBe(false);
  });
});

describe("Sentiment", () => {
  it("classifies negative execution language", () => {
    expect(detectSentiment("I am stuck and overwhelmed")).toBe("negative");
  });
  it("classifies positive language", () => {
    expect(detectSentiment("Great progress — shipped on time")).toBe("positive");
  });
});

describe("Feature flags", () => {
  it("chat and multi-channel notifications enabled by default", () => {
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.CHAT_ENABLED)).toBe(true);
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.NOTIFICATIONS_MULTI_CHANNEL_ENABLED)).toBe(
      true,
    );
  });
});

describe("Notification types", () => {
  it("exports multi-channel notification types for routing", async () => {
    const mod = await import("../../../engines/notifications/NotificationDeliveryEngine.js");
    expect(mod.NOTIFICATION_TYPES).toContain("blocker");
    expect(mod.CHANNEL_TYPES).toContain("in-app");
  });
});
