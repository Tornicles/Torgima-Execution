import type { Condition } from "../constants/conditions.js";

// ConditionCode is the canonical Torgima condition vocabulary; mirrors
// the `condition` Postgres enum and `constants/conditions.CONDITIONS`.
export type ConditionCode = Condition;

export interface SignalState {
  userId: string;
  momentum: number;
  consistency: number;
  velocity: number;
  condition: ConditionCode;
  streak: number;
  computedAt: string;
}

export interface SignalSnapshot {
  id: string;
  userId: string;
  momentum: number;
  consistency: number;
  velocity: number;
  condition: string;
  snapshotDate: string;
}
