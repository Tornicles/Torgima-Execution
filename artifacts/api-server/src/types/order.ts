export type OrderStatus =
  | "queued"
  | "active"
  | "in_progress"
  | "paused"
  | "blocked"
  | "complete"
  | "cancelled";

export type OrderType =
  | "action"
  | "research"
  | "review"
  | "habit"
  | "milestone"
  | "checkpoint";

export interface Order {
  id: string;
  blueprintId: string;
  userId: string;
  title: string;
  description: string | null;
  type: OrderType;
  status: OrderStatus;
  priority: number;
  estimatedMinutes: number | null;
  instructions: string | null;
  proofRequired: boolean;
  blockedReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
