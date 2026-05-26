import type { ChronologyResult, TemporalInput } from "../contracts/types.js";

export class ChronologyEngine {
  sequence(input: TemporalInput): ChronologyResult {
    const now = new Date();
    const timeline: ChronologyResult["timeline"] = [
      { at: new Date(now.getTime() - 7 * 86400000).toISOString(), event: "Past context established" },
      { at: now.toISOString(), event: "Present decision point" },
      {
        at: new Date(now.getTime() + 7 * 86400000).toISOString(),
        event: "Future milestone",
      },
    ];

    if (input.execution?.completedAt) {
      timeline.unshift({
        at: String(input.execution.completedAt),
        event: "Prior execution completed",
      });
    }

    const ordering = ["observe", "decide", "schedule", "execute", "learn"];
    const causes: string[] = [];
    if (input.world) causes.push("World state influences timing");
    if (input.identity?.burnout) causes.push("Identity fatigue affects velocity");

    return { timeline, ordering, causes };
  }

  replay(events: ChronologyResult["timeline"], version: number): ChronologyResult["timeline"] {
    return events.slice(0, Math.max(1, version));
  }
}

export const chronologyEngine = new ChronologyEngine();
