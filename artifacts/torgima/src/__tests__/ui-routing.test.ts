import { describe, expect, it } from "vitest";
import { isPreLaunchPath } from "@/hooks/useAppRouteGuard";

describe("isPreLaunchPath", () => {
  it("treats /validate as pre-launch", () => {
    expect(isPreLaunchPath("/validate")).toBe(true);
  });

  it("treats validation results as pre-launch", () => {
    expect(isPreLaunchPath("/validation/abc-123/results")).toBe(true);
  });

  it("treats validation running as pre-launch", () => {
    expect(isPreLaunchPath("/validation/abc-123/running")).toBe(true);
  });

  it("treats /dashboard as post-launch", () => {
    expect(isPreLaunchPath("/dashboard")).toBe(false);
  });

  it("treats /blueprint as post-launch", () => {
    expect(isPreLaunchPath("/blueprint")).toBe(false);
  });
});
