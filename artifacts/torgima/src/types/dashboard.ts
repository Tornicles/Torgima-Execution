/**
 * DOC 33 — dashboard projection view model (server truth only).
 */

export type OrderSummary = {
  orderId: string;
  title: string;
  instruction: string;
  difficulty: string;
  timeEstimate?: number | null;
  timeEstimateMinutes?: number | null;
  proofRequired: boolean;
  allowedActions: string[];
  priorityReason?: string | null;
  status?: string;
  generationReason?: string | null;
};

export type SignalSummaryStrip = {
  completionRate?: number;
  momentum?: number;
  trend?: string;
  label?: string;
};

export type DependencyAlert = {
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export type RecoveryAlert = {
  message: string;
  actionHref?: string;
};

export type IdentitySnapshot = {
  stage?: string;
  label?: string;
  description?: string;
};

export type RewardSnapshot = {
  type?: string;
  label?: string;
  message?: string;
};

export type DashboardControlProjection = {
  stateVersion: number;
  blueprintId: string | null;
  condition: string;
  conditionLabel: string;
  currentAction: OrderSummary | null;
  pendingSync: boolean;
  locked: boolean;
  lockReason?: string;
  signalSummary: SignalSummaryStrip;
  dependencyAlert?: DependencyAlert;
  recoveryAlert?: RecoveryAlert;
  identitySnapshot?: IdentitySnapshot;
  rewardSnapshot?: RewardSnapshot;
};
