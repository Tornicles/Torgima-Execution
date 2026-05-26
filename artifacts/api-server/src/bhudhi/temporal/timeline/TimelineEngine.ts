import type { TemporalInput, TimelineResult } from "../contracts/types.js";

export class TimelineEngine {
  build(input: TemporalInput): TimelineResult {
    const phases = [
      { phase: "prepare", start: new Date().toISOString() },
      { phase: "execute", start: new Date(Date.now() + 2 * 86400000).toISOString() },
      { phase: "review", start: new Date(Date.now() + 9 * 86400000).toISOString() },
    ];

    const taskCount = (input.tasks ?? []).length;
    const buffer = Math.max(1, Math.ceil(taskCount * 0.5));
    let health = 0.7;
    if (input.constraints?.includes("tight_deadline")) health -= 0.2;
    if (input.life?.burnout) health -= 0.25;

    return { timeline: phases, health: Math.max(0.2, health), buffer };
  }

  shift(timeline: TimelineResult, days: number): TimelineResult {
    return {
      ...timeline,
      timeline: timeline.timeline.map((p) => ({
        ...p,
        start: new Date(new Date(p.start).getTime() + days * 86400000).toISOString(),
      })),
      buffer: timeline.buffer + Math.abs(days),
    };
  }
}

export const timelineEngine = new TimelineEngine();
