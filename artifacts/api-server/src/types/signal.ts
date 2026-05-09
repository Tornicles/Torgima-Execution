export type ConditionCode =
  | "optimal"
  | "building"
  | "recovering"
  | "critical"
  | "blocked";

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
