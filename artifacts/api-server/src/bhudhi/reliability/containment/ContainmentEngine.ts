import type { ContainmentAction, ContainmentResult, DetectedIncident } from "../contracts/types.js";

export class ContainmentEngine {
  contain(incidents: DetectedIncident[]): ContainmentResult[] {
    const results: ContainmentResult[] = [];

    for (const inc of incidents) {
      if (inc.incident === "none") continue;

      let action: ContainmentAction = "throttle";
      if (inc.severity === "SYSTEM" || inc.severity === "CRITICAL") {
        action = "freeze";
      } else if (inc.incident === "dependency_failure") {
        action = "reroute";
      } else if (inc.incident === "resource_exhaustion") {
        action = "degrade";
      } else if (inc.incident === "loop" || inc.incident === "deadlock") {
        action = "isolate";
      }

      results.push({
        action,
        target: inc.incident,
        reason: `Contain ${inc.incident} at ${inc.severity} — failure stays local`,
      });
    }

    return results;
  }

  shouldBlock(containment: ContainmentResult[]): boolean {
    return containment.some((c) => c.action === "freeze");
  }
}

export const containmentEngine = new ContainmentEngine();
