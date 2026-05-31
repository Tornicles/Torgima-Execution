import { describe, it, expect } from "vitest";
import { correctionTypeToTaskType } from "../../../engines/failure/FailureClassificationEngine.js";

/** Mirrors FailureClassificationEngine capability blocker routing (fast-path contract). */
function routeBlockerType(blockerType: string | undefined): string {
  const bt = (blockerType ?? "").toLowerCase();
  if (
    bt.includes("capability") ||
    bt.includes("skill") ||
    bt === "knowledge_gap" ||
    bt === "capability_gap"
  ) {
    return correctionTypeToTaskType("academy_task_requested");
  }
  return correctionTypeToTaskType("dependency_resolution_requested");
}

describe("FailureClassificationEngine — capability_gap blockers", () => {
  it("routes capability_gap to academy task type", () => {
    expect(routeBlockerType("capability_gap")).toBe("academy");
  });

  it("routes skill blockers to academy", () => {
    expect(routeBlockerType("skill_gap")).toBe("academy");
  });

  it("routes vendor blockers to dependency resolution", () => {
    expect(routeBlockerType("vendor_delay")).toBe("blocker_resolution");
  });
});
