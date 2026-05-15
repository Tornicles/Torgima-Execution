/** Deterministic operational copy from persisted signal / condition / enforcement shapes (no Bhudhi). */

export interface SignalProjectionLite {
  completionRate: number;
  weightedScore: number;
  momentum: number;
  trend: string | null;
  confidence: string | null;
  blockerRatio: number | null;
  skipRatio: number | null;
}

export interface ConditionDetailLite {
  condition: string;
  durationDays: number;
  recoveryRequired: boolean;
  escalationLevel: number;
  transitionReason: string | null;
  previousCondition: string | null;
}

export function deriveSignalBlueprintBridgeLines(params: {
  condition: ConditionDetailLite;
  signalProjection: SignalProjectionLite | null;
  enforcementPhasePermission: string | null;
  difficultyCap: string | null;
  pivotReviewOpen: boolean;
}): Array<{ headline: string; cite: string }> {
  const lines: Array<{ headline: string; cite: string }> = [];

  const tr = params.condition.transitionReason?.trim();
  if (tr) {
    lines.push({
      headline: `Condition transition (${params.condition.condition}).`,
      cite: `Recorded transition reason on condition row: ${tr}`,
    });
  } else if (params.condition.previousCondition) {
    lines.push({
      headline: `Current condition: ${params.condition.condition}.`,
      cite: `Previous condition recorded: ${params.condition.previousCondition}.`,
    });
  }

  const sp = params.signalProjection;
  if (sp) {
    const cr = Math.round(sp.completionRate * 1000) / 10;
    lines.push({
      headline: `Signal window: completion rate ${cr}% · trend ${sp.trend ?? "unknown"} · confidence ${sp.confidence ?? "unknown"}.`,
      cite: "Derived from current signal snapshot rows (weighted score / momentum persisted there).",
    });
    if (sp.blockerRatio != null && sp.blockerRatio > 0.2) {
      lines.push({
        headline: `Blocker share in window is elevated (${Math.round(sp.blockerRatio * 100)}%).`,
        cite: "blocker_ratio on current snapshot.",
      });
    }
    if (sp.skipRatio != null && sp.skipRatio > 0.15) {
      lines.push({
        headline: `Skip share in window is notable (${Math.round(sp.skipRatio * 100)}%).`,
        cite: "skip_ratio on current snapshot.",
      });
    }
  }

  if (params.enforcementPhasePermission === "blocked" || params.enforcementPhasePermission === "restricted") {
    lines.push({
      headline: `Enforcement restricts phase progression (${params.enforcementPhasePermission}).`,
      cite: "phase_permission field on current enforcement package.",
    });
  }

  if (params.difficultyCap === "hard" || params.difficultyCap === "very_hard") {
    lines.push({
      headline: `Difficulty cap tightened to ${params.difficultyCap}.`,
      cite: "difficulty_cap on current enforcement package.",
    });
  }

  if (params.pivotReviewOpen) {
    lines.push({
      headline: "Strategic pivot review is open.",
      cite: "pivot_reviews with status open for this blueprint.",
    });
  }

  return lines.slice(0, 8);
}

export function deriveOperationalAwarenessLines(params: {
  condition: ConditionDetailLite | null;
  signalProjection: SignalProjectionLite | null;
  enforcementPhasePermission: string | null;
  pivotReviewOpen: boolean;
  hasBlockedOrders: boolean;
  lockedPhaseCount: number;
}): string[] {
  const out: string[] = [];

  if (params.pivotReviewOpen) out.push("Strategic pivot decision pending — progression may stall until resolved.");

  if (params.condition?.recoveryRequired) out.push("Recovery flagged on condition record — expect tighter proof or reduced scope.");

  if (params.signalProjection) {
    const cr = params.signalProjection.completionRate;
    if (cr < 0.45 && params.signalProjection.confidence !== "insufficient_data") {
      out.push("Completion rate under midline versus recent signal window — execution continuity weakening.");
    }
    if (
      params.signalProjection.trend === "declining" ||
      params.signalProjection.trend === "volatile"
    ) {
      out.push(`Signal trend is ${params.signalProjection.trend} — conditioning may constrain orders.`);
    }
  }

  if (params.enforcementPhasePermission === "blocked" || params.enforcementPhasePermission === "restricted") {
    out.push("Enforcement phase permission restricts advancement — blueprint obeys control package.");
  }

  if (params.hasBlockedOrders) out.push("At least one active order is blocked — dependency or proof chain needs clearing.");

  if (params.lockedPhaseCount > 0) {
    out.push(`${params.lockedPhaseCount} phase(s) remain structurally locked — dependencies or prior phase completion required.`);
  }

  return out.slice(0, 6);
}

export function deriveExecutionIdentityLines(params: {
  momentumStreakDays: number;
  feedbackCyclesThisWeek: number;
  completedOrdersAllTime: number;
  operatingPattern: string | null;
}): string[] {
  const lines: string[] = [];
  if (params.momentumStreakDays > 0) {
    lines.push(`Signal momentum streak field: ${params.momentumStreakDays} (engine-native counter on snapshot).`);
  }
  if (params.feedbackCyclesThisWeek > 0) {
    lines.push(`Proof / feedback cycles recorded this week: ${params.feedbackCyclesThisWeek}.`);
  }
  if (params.completedOrdersAllTime > 0) {
    lines.push(`Completed execution orders (all deployments): ${params.completedOrdersAllTime}.`);
  }
  if (params.operatingPattern) {
    lines.push(`Latest behavior pattern tag: ${params.operatingPattern}.`);
  }
  return lines.slice(0, 6);
}
