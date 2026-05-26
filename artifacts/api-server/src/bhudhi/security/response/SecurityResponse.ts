import type { ResponseAction, ThreatResult, ThreatSeverity } from "../contracts/types.js";

export class SecurityResponse {
  respond(threats: ThreatResult[]): { action: ResponseAction; steps: string[] } {
    const severity = this.topSeverity(threats);

    let action: ResponseAction = "warn";
    const steps = ["detect", "contain", "recover", "learn"];

    if (severity === "LOCKDOWN" || severity === "CRITICAL") {
      action = "freeze";
      steps.unshift("revoke all elevated tokens");
    } else if (severity === "HIGH") {
      action = "revoke";
    } else if (severity === "MEDIUM") {
      action = "degrade";
    }

    return { action, steps };
  }

  private topSeverity(threats: ThreatResult[]): ThreatSeverity {
    const order: ThreatSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "LOCKDOWN"];
    let top: ThreatSeverity = "LOW";
    for (const t of threats) {
      if (t.threat === "none") continue;
      if (order.indexOf(t.severity) > order.indexOf(top)) top = t.severity;
    }
    return top;
  }
}

export const securityResponse = new SecurityResponse();
