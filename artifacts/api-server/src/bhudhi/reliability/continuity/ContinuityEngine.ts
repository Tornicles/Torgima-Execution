import type { ContinuityMode, DetectedIncident, ReliabilityInput } from "../contracts/types.js";

export class ContinuityEngine {
  evaluate(input: ReliabilityInput, incidents: DetectedIncident[]): {
    mode: ContinuityMode;
    guarantees: string[];
  } {
    const critical = incidents.some((i) => i.severity === "SYSTEM");
    const major = incidents.some((i) => i.severity === "CRITICAL" || i.severity === "MAJOR");

    let mode: ContinuityMode = "ONLINE";
    if (critical) mode = "OFFLINE";
    else if (major) mode = "DEGRADED";
    else if (input.execution?.recovering === true) mode = "RECOVERY";

    const guarantees = [
      "execution continuity",
      "memory continuity",
      "decision continuity",
      "state continuity",
    ];

    if (mode === "OFFLINE") {
      return { mode, guarantees: guarantees.map((g) => `${g} — suspended until recovery`) };
    }

    return { mode, guarantees };
  }
}

export const continuityEngine = new ContinuityEngine();
