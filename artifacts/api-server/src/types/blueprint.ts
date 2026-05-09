export type BlueprintStatus =
  | "draft"
  | "validating"
  | "active"
  | "paused"
  | "complete"
  | "abandoned";

export type BlueprintDomain =
  | "genesis"
  | "market"
  | "delivery"
  | "continuity"
  | "identity"
  | "capability";

export interface Blueprint {
  id: string;
  userId: string;
  title: string;
  rawGoal: string;
  domain: string;
  status: BlueprintStatus;
  phase: number;
  totalPhases: number;
  currentCondition: string | null;
  pausedReason: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface BlueprintState {
  blueprint: Blueprint;
  activeOrders: import("./order.js").Order[];
  signals: import("./signal.js").SignalState;
  condition: string;
  phaseProgress: number;
}
