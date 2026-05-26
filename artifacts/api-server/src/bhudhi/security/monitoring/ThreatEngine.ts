import type { SecurityInput, ThreatResult, ThreatSeverity } from "../contracts/types.js";

export class ThreatEngine {
  detect(input: SecurityInput): ThreatResult[] {
    const threats: ThreatResult[] = [];

    if (input.execution?.privilegeEscalation === true) {
      threats.push({
        threat: "privilege_escalation",
        severity: "CRITICAL",
        containment: "revoke elevated permissions",
      });
    }
    if (input.execution?.abuse === true) {
      threats.push({
        threat: "abuse",
        severity: "HIGH",
        containment: "throttle actor",
      });
    }
    if (input.identity?.driftDetected === true || input.execution?.tampering === true) {
      threats.push({
        threat: "tampering",
        severity: "HIGH",
        containment: "freeze execution surface",
      });
    }
    if (input.execution?.exfiltration === true) {
      threats.push({
        threat: "exfiltration",
        severity: "LOCKDOWN",
        containment: "isolate network partition",
      });
    }
    if (input.execution?.recursionDepth && Number(input.execution.recursionDepth) > 10) {
      threats.push({
        threat: "recursion",
        severity: "MEDIUM",
        containment: "cap recursion depth",
      });
    }

    if (threats.length === 0) {
      threats.push({
        threat: "none",
        severity: "LOW",
        containment: "continue monitoring",
      });
    }

    return threats;
  }

  topSeverity(threats: ThreatResult[]): ThreatSeverity {
    const order: ThreatSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "LOCKDOWN"];
    let top: ThreatSeverity = "LOW";
    for (const t of threats) {
      if (order.indexOf(t.severity) > order.indexOf(top)) top = t.severity;
    }
    return top;
  }
}

export const threatEngine = new ThreatEngine();
