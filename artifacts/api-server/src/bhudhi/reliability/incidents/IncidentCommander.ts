import { randomUUID } from "node:crypto";
import type { DetectedIncident, IncidentRecord } from "../contracts/types.js";

export class IncidentCommander {
  run(incidents: DetectedIncident[]): IncidentRecord {
    const actionable = incidents.filter((i) => i.incident !== "none");
    const top = actionable[0] ?? incidents[0];

    const severity = top?.severity ?? "INFO";
    const sla =
      severity === "SYSTEM" ? 1 : severity === "CRITICAL" ? 4 : severity === "MAJOR" ? 12 : 24;

    let status: IncidentRecord["status"] = "open";
    if (severity === "INFO" || severity === "WARNING") status = "closed";
    else if (severity === "MAJOR") status = "contained";
    else status = "recovering";

    return {
      incidentId: randomUUID(),
      owner: severity === "SYSTEM" || severity === "CRITICAL" ? "reliability-oncall" : "system",
      sla,
      status,
    };
  }
}

export const incidentCommander = new IncidentCommander();
