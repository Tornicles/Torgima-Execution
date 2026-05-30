/**
 * Deterministic Bhudhi explanations from live dashboard / blueprint facts (no invented metrics).
 */
import {
  BHUDHI_POPULAR_QUESTIONS,
  type BhudhiCatalogQuestion,
} from "./bhudhiQuestionCatalog.js";

export interface BhudhiExplainContext {
  condition: string;
  conditionDurationDays: number;
  transitionReason: string | null;
  recoveryRequired: boolean;
  completionRate: number;
  momentum: number;
  trend: string | null;
  signalConfidence: string | null;
  goalProgressPercent: number;
  currentTaskTitle: string | null;
  operationalLines: string[];
  bridgeLines: Array<{ headline: string; cite: string }>;
  intelligenceHeadline: string | null;
  intelligenceBody: string | null;
  identityStage: string | null;
  identitySummary: string | null;
  primaryRisk: string | null;
  primaryOpportunity: string | null;
  allowedActions: string[];
  restrictedActions: string[];
  atRiskOrderCount: number;
  queuedOrderCount: number;
}

function momentumLabel(momentum: number): string {
  if (momentum < -0.1) return "Weak";
  if (momentum < 0.25) return "Moderate";
  if (momentum < 0.55) return "Strong";
  return "Accelerating";
}

function focusLabel(condition: string, recoveryRequired: boolean): string {
  if (recoveryRequired || condition === "danger") return "Recover";
  if (condition === "urgency") return "Stabilize";
  if (condition === "power" || condition === "affluence") return "Scale";
  if (condition === "power_change") return "Protect";
  if (condition === "nothingness") return "Build";
  return "Execute";
}

export function buildDeterministicExplanation(
  questionKey: string,
  ctx: BhudhiExplainContext,
): { title: string; sections: Array<{ heading: string; body: string }>; confidence: number } {
  const cond = ctx.condition.replace(/_/g, " ");
  const mom = momentumLabel(ctx.momentum);
  const focus = focusLabel(ctx.condition, ctx.recoveryRequired);
  const cr = Math.round(ctx.completionRate <= 1 ? ctx.completionRate * 100 : ctx.completionRate);

  const baseWhy = ctx.bridgeLines[0]?.headline ?? ctx.operationalLines[0] ?? null;
  const baseCite = ctx.bridgeLines[0]?.cite ?? "Derived from current condition and signal snapshot rows.";

  switch (questionKey) {
    case "why_this_task":
      return {
        title: "Why this task?",
        sections: [
          {
            heading: "What the system assigned",
            body: ctx.currentTaskTitle
              ? `Your highest-priority active order is "${ctx.currentTaskTitle}". It was ranked using condition (${cond}), signal completion (${cr}%), and blueprint dependencies.`
              : "No pending or active order is currently assigned. The orders engine will surface the next task when capacity and condition allow.",
          },
          {
            heading: "Why it matters now",
            body:
              ctx.intelligenceBody ??
              ctx.intelligenceHeadline ??
              baseWhy ??
              `Today's focus is ${focus}. Tasks are limited while condition is ${cond}.`,
          },
          { heading: "Evidence", body: baseCite },
        ],
        confidence: ctx.currentTaskTitle ? 0.85 : 0.6,
      };

    case "skip_task_impact":
      return {
        title: "What happens if I skip it?",
        sections: [
          {
            heading: "Signal impact",
            body: `Skipping increases skip ratio on your signal window and can reduce momentum (currently ${mom}). Completion rate is ${cr}%.`,
          },
          {
            heading: "Condition impact",
            body: ctx.recoveryRequired
              ? "You are in recovery-required state — skipping may extend recovery duration."
              : `Under ${cond}, restricted actions include: ${ctx.restrictedActions.slice(0, 4).join(", ") || "none recorded"}.`,
          },
          {
            heading: "Blueprint impact",
            body:
              ctx.primaryRisk ??
              "Delayed tasks push milestone variance and can tighten enforcement on phase progression.",
          },
        ],
        confidence: 0.78,
      };

    case "task_goal_link":
      return {
        title: "How does this help my goal?",
        sections: [
          {
            heading: "Goal progress",
            body: `Main goal progress is ${ctx.goalProgressPercent}% based on current phase readiness and signal completion.`,
          },
          {
            heading: "Task linkage",
            body: ctx.currentTaskTitle
              ? `"${ctx.currentTaskTitle}" advances the active phase checkpoint tied to your blueprint goal.`
              : "Complete the next surfaced order to move phase completion forward.",
          },
          { heading: "Strategic context", body: ctx.primaryOpportunity ?? baseWhy ?? "No additional opportunity signal on record." },
        ],
        confidence: 0.75,
      };

    case "why_this_condition":
      return {
        title: "Why this condition?",
        sections: [
          {
            heading: "Current condition",
            body: `You are in ${cond.toUpperCase()} (${ctx.conditionDurationDays} days in this state).`,
          },
          {
            heading: "What caused it",
            body:
              ctx.transitionReason ??
              baseWhy ??
              "Transition reason was not recorded on the condition row; enforcement uses the last persisted condition state.",
          },
          {
            heading: "What it allows",
            body: `Allowed: ${ctx.allowedActions.join(", ") || "execution"}. Restricted: ${ctx.restrictedActions.join(", ") || "none"}.`,
          },
        ],
        confidence: ctx.transitionReason ? 0.88 : 0.72,
      };

    case "why_this_signal":
      return {
        title: "Why this signal?",
        sections: [
          {
            heading: "Signal window",
            body: `Completion ${cr}% · momentum ${mom} · trend ${ctx.trend ?? "stable"} · confidence ${ctx.signalConfidence ?? "unknown"}.`,
          },
          { heading: "Interpretation", body: baseWhy ?? (ctx.operationalLines.join(" ") || "Signals reflect recent order and feedback outcomes.") },
          { heading: "Source", body: baseCite },
        ],
        confidence: 0.8,
      };

    case "capacity_drop":
      return {
        title: "Why did my capacity drop?",
        sections: [
          {
            heading: "Load vs capacity",
            body: `${ctx.atRiskOrderCount} orders at risk · ${ctx.queuedOrderCount} queued. Condition ${cond} caps daily task volume.`,
          },
          {
            heading: "Drivers",
            body:
              ctx.operationalLines.join(" ") ||
              ctx.restrictedActions.length > 0
                ? `Restricted: ${ctx.restrictedActions.join(", ")}.`
                : "No explicit restriction list — check enforcement package.",
          },
        ],
        confidence: 0.77,
      };

    case "right_direction":
      return {
        title: "Am I in the right direction?",
        sections: [
          { heading: "Progress", body: `Goal progress ${ctx.goalProgressPercent}% with momentum ${mom}.` },
          { heading: "Risk", body: ctx.primaryRisk ?? "No primary risk flagged by predictive intelligence." },
          { heading: "Opportunity", body: ctx.primaryOpportunity ?? "No primary opportunity flagged." },
        ],
        confidence: 0.7,
      };

    case "alternatives":
      return {
        title: "What are my alternatives?",
        sections: [
          {
            heading: "Within current condition",
            body: `Allowed work types: ${ctx.allowedActions.join(", ") || "execution"}. Focus mode: ${focus}.`,
          },
          {
            heading: "If signals improve",
            body: "Stabilize completion and feedback quality to unlock broader task types and phase progression.",
          },
        ],
        confidence: 0.68,
      };

    case "focus_priority":
      return {
        title: "What should I focus on?",
        sections: [
          { heading: "Today's focus", body: `${focus} — derived from condition ${cond} and recovery flag ${ctx.recoveryRequired}.` },
          {
            heading: "Next action",
            body: ctx.intelligenceHeadline ?? (ctx.currentTaskTitle ? `Complete: ${ctx.currentTaskTitle}` : "Awaiting next order from engine."),
          },
        ],
        confidence: 0.82,
      };

    case "my_patterns":
      return {
        title: "What are my patterns?",
        sections: [
          { heading: "Execution pattern", body: `Trend ${ctx.trend ?? "stable"} · completion ${cr}% over current window.` },
          { heading: "Behavior signals", body: ctx.operationalLines.join(" ") || "Insufficient feedback density for pattern classification." },
        ],
        confidence: 0.65,
      };

    case "identity_stage":
      return {
        title: "What is my identity stage?",
        sections: [
          { heading: "Stage", body: ctx.identityStage ?? "Not yet evaluated from verified feedback evidence." },
          { heading: "Summary", body: ctx.identitySummary ?? "Identity continuity updates when valid feedback cycles accumulate." },
        ],
        confidence: ctx.identityStage ? 0.8 : 0.5,
      };

    case "growth_edge":
      return {
        title: "What is my growth edge?",
        sections: [
          { heading: "Edge", body: ctx.primaryOpportunity ?? ctx.intelligenceBody ?? "Complete high-leverage orders to raise momentum." },
          { heading: "Constraint", body: ctx.primaryRisk ?? `Condition ${cond} limits expansion work until signals stabilize.` },
        ],
        confidence: 0.72,
      };

    case "why_this_focus":
      return {
        title: "Why this focus?",
        sections: [{ heading: "Focus", body: `${focus} is the operational focus for ${cond}.` }, { heading: "Reason", body: baseWhy ?? ctx.transitionReason ?? "Derived from condition rules." }],
        confidence: 0.85,
      };

    case "why_momentum_level":
      return {
        title: "Why this momentum level?",
        sections: [
          { heading: "Level", body: `Momentum is ${mom} (${ctx.momentum >= 0 ? "+" : ""}${Math.round(ctx.momentum * 100) / 10}% window metric).` },
          { heading: "Evidence", body: baseCite },
        ],
        confidence: 0.8,
      };

    case "goal_progress_drivers":
      return {
        title: "What's affecting goal progress?",
        sections: [
          { heading: "Progress", body: `${ctx.goalProgressPercent}% — phase readiness and signal completion combined.` },
          { heading: "Factors", body: [...ctx.operationalLines, ...ctx.bridgeLines.map((l) => l.headline)].slice(0, 4).join(" ") || "No drift alerts." },
        ],
        confidence: 0.78,
      };

    default:
      return {
        title: questionKey.replace(/_/g, " "),
        sections: [
          { heading: "System state", body: `Condition: ${cond}. Momentum: ${mom}. Progress: ${ctx.goalProgressPercent}%.` },
          { heading: "Bhudhi note", body: "Bhudhi explains from recorded system facts only — no autonomous decisions." },
        ],
        confidence: 0.55,
      };
  }
}

export function questionFromCatalog(key: string): BhudhiCatalogQuestion | undefined {
  return BHUDHI_POPULAR_QUESTIONS.find((q) => q.key === key);
}
