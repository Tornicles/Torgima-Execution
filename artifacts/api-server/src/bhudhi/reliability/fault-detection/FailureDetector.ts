import type { DetectedIncident, IncidentSeverity, ReliabilityInput } from "../contracts/types.js";

const SEVERITY_ORDER: IncidentSeverity[] = ["INFO", "WARNING", "MAJOR", "CRITICAL", "SYSTEM"];

export class FailureDetector {
  detect(input: ReliabilityInput): DetectedIncident[] {
    const incidents: DetectedIncident[] = [];

    if (input.execution?.timeout === true || Number(input.execution?.latencyMs) > 30000) {
      incidents.push({
        incident: "timeout",
        severity: "MAJOR",
        confidence: 0.85,
      });
    }

    if (input.memory && typeof input.memory === "object" && input.memory.driftDetected === true) {
      incidents.push({ incident: "drift", severity: "WARNING", confidence: 0.75 });
    }

    if (input.execution?.hallucination === true) {
      incidents.push({ incident: "hallucination", severity: "CRITICAL", confidence: 0.9 });
    }

    if (input.execution?.deadlock === true) {
      incidents.push({ incident: "deadlock", severity: "SYSTEM", confidence: 0.95 });
    }

    if (input.execution?.loopDetected === true) {
      incidents.push({ incident: "loop", severity: "MAJOR", confidence: 0.8 });
    }

    if (input.execution?.dependencyFailure === true) {
      incidents.push({ incident: "dependency_failure", severity: "CRITICAL", confidence: 0.88 });
    }

    if (input.economics?.exhausted === true || input.execution?.resourceExhaustion === true) {
      incidents.push({ incident: "resource_exhaustion", severity: "CRITICAL", confidence: 0.92 });
    }

    if (incidents.length === 0) {
      incidents.push({ incident: "none", severity: "INFO", confidence: 0.6 });
    }

    return incidents;
  }

  topSeverity(incidents: DetectedIncident[]): IncidentSeverity {
    let top: IncidentSeverity = "INFO";
    for (const i of incidents) {
      if (SEVERITY_ORDER.indexOf(i.severity) > SEVERITY_ORDER.indexOf(top)) {
        top = i.severity;
      }
    }
    return top;
  }
}

export const failureDetector = new FailureDetector();
