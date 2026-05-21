import { describe, it, expect } from "vitest";
import {
  buildWidgetEmbedCode,
  profileIsVisible,
} from "../../../engines/profile/PublicProfileEngine.js";
import { FEATURE_FLAGS, isFeatureEnabledByDefault } from "../../../constants/feature-flags.js";

describe("profileIsVisible", () => {
  const base = {
    privacy_setting: "public",
    profile_public: true,
  } as Parameters<typeof profileIsVisible>[0];

  it("allows public profiles", () => {
    expect(profileIsVisible({ ...base, privacy_setting: "public", profile_public: true })).toBe(
      true,
    );
  });

  it("blocks private profiles", () => {
    expect(
      profileIsVisible({ ...base, privacy_setting: "private", profile_public: false }),
    ).toBe(false);
  });

  it("allows link-only with link access flag", () => {
    expect(
      profileIsVisible(
        { ...base, privacy_setting: "link-only", profile_public: false },
        true,
      ),
    ).toBe(true);
  });

  it("blocks link-only without direct link", () => {
    expect(
      profileIsVisible(
        { ...base, privacy_setting: "link-only", profile_public: false },
        false,
      ),
    ).toBe(false);
  });
});

describe("buildWidgetEmbedCode", () => {
  it("returns iframe HTML for streak widget", () => {
    const html = buildWidgetEmbedCode("user-1", "streak-counter", "https://app.test");
    expect(html).toContain("<iframe");
    expect(html).toContain("streak-counter");
    expect(html).toContain("user-1");
  });

  it("supports all four widget types", () => {
    for (const type of [
      "streak-counter",
      "level-badge",
      "accountability-card",
      "principle-record",
    ]) {
      expect(buildWidgetEmbedCode("u", type, "https://x.test")).toContain(type);
    }
  });
});

describe("feature flag", () => {
  it("public_profiles_enabled defaults on in phase 1", () => {
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.PUBLIC_PROFILES_ENABLED)).toBe(true);
  });
});
