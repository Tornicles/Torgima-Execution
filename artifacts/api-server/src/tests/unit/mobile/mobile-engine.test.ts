import { describe, it, expect } from "vitest";
import { resolveSyncConflict } from "../../../engines/mobile/MobileEngine.js";
import { FEATURE_FLAGS, isFeatureEnabledByDefault } from "../../../constants/feature-flags.js";

describe("Mobile sync conflict", () => {
  it("feedback uses local-wins", () => {
    expect(resolveSyncConflict("feedback")).toBe("local-wins");
    expect(resolveSyncConflict("execution/feedback")).toBe("local-wins");
  });

  it("other resources use remote-wins", () => {
    expect(resolveSyncConflict("tasks")).toBe("remote-wins");
  });
});

describe("Feature flags", () => {
  it("mobile app enabled by default", () => {
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.MOBILE_APP_ENABLED)).toBe(true);
  });
});
