import type { ScheduleResult, TemporalInput } from "../contracts/types.js";

const PROTECTED = ["sleep", "health", "signals", "conditions"];

export class SchedulingEngine {
  schedule(input: TemporalInput): ScheduleResult {
    const tasks = (input.tasks ?? []).map((t) => t.id);
    const sequence = [...tasks].sort((a, b) => {
      const da = input.tasks?.find((t) => t.id === a)?.dueAt;
      const db = input.tasks?.find((t) => t.id === b)?.dueAt;
      if (da && db) return new Date(da).getTime() - new Date(db).getTime();
      return 0;
    });

    const rescheduled: string[] = [];
    if (input.life?.burnout && sequence.length > 2) {
      rescheduled.push(sequence.pop()!);
    }

    return {
      sequence,
      protected: [...PROTECTED],
      rescheduled,
    };
  }
}

export const schedulingEngine = new SchedulingEngine();
