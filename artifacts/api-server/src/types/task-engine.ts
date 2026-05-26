import type { MiniPlanKey } from "../engines/mini-plan/MiniPlanAllocationEngine.js";

export type BlueprintTierKey = "starter" | "growth" | "ultimate";

export interface TaskScheduleOptions {
  /** 0 = today (visible), 1+ = hidden future days */
  dayOffset: number;
  miniPlanKey: MiniPlanKey;
}

export interface TaskQueueSnapshot {
  visibleToday: Array<{ id: string; title: string; miniPlanKey: string | null; status: string }>;
  hiddenCount: number;
  hiddenByDay: Array<{ dayOffset: number; dateKey: string; count: number; pattern: string[] }>;
  horizonDays: number;
  dailyTotal: number;
  allocation: { Foundation: number; Operations: number; Growth: number };
  dailyTaskCounts: { Foundation: number; Operations: number; Growth: number };
  condition: string;
}
