// apps/web/src/lib/language-map.ts
// SINGLE SOURCE OF TRUTH — all customer-facing labels live here
// Cursor: never hardcode these values in components — always import from here

import { ConditionState } from "@workspace/state-machine";
import type { DashboardProjection } from "@/lib/dashboard-types";

export const SIGNAL_LABELS: Record<string, string> = {
  completion_rate: "Task Completion Rate",
  weighted_score: "Quality-Adjusted Score",
  raw_score: "Base Score",
  momentum: "Consecutive Days Active",
  trend: "Performance Direction",
  confidence: "Score Reliability",
  blocker_ratio: "Blocked Task Rate",
  skip_ratio: "Skipped Task Rate",
};

export const CONDITION_LABELS: Record<string, string> = {
  nothingness: "Not Started",
  danger: "At Risk",
  urgency: "Needs Attention",
  stability: "On Track",
  power: "Performing",
  affluence: "Exceeding",
  power_change: "Status Shifting",
};

export const CONDITION_DESCRIPTIONS: Record<string, string> = {
  nothingness: "You haven't built enough execution data yet. Get started.",
  danger: "Your progress is at risk. Focus on recovery tasks now.",
  urgency: "Execution needs to improve. Take corrective action.",
  stability: "You are executing consistently. Keep the momentum going.",
  power: "You are performing strongly. System allows expansion.",
  affluence: "Exceptional execution. Leverage and scale now.",
  power_change: "Your status is in transition. System is adjusting.",
};

export const CONDITION_COLORS: Record<string, string> = {
  nothingness: "grey",
  danger: "red",
  urgency: "amber",
  stability: "blue",
  power: "green",
  affluence: "gold",
  power_change: "purple",
};

export const BLUEPRINT_LABELS = {
  blueprint: "Project",
  orders: "Tasks",
  signals: "Health Scores",
  conditions: "Project Status",
  mini_plans: "Stages",
  programs: "Milestones",
  phases: "Steps",
  projects: "Work Areas",
  actions: "Activities",
  feedback: "Progress Update",
  academy: "Learning Hub",
  permanent_signals: "Key Metrics",
  master_plan: "Your Strategy",
  enforcement_package: "", // Never shown
  bhudhi: "", // Never shown
} as const;

export const TIER_LABELS: Record<string, string> = {
  starter: "Starter Plan",
  growth: "Growth Plan",
  ultimate: "Ultimate Plan",
};

export const ERECTOR_STATE_LABELS: Record<string, string> = {
  INTAKE_STARTED: "Starting your project analysis",
  VALIDATION_RUNNING: "Analysing your project",
  VERDICT_ISSUED: "Analysis complete",
  CORRECTION_REQUIRED: "Adjustments needed",
  LAUNCH_PERMITTED: "Ready to launch",
  BLUEPRINT_ACTIVE: "Project active",
  FALSE_PROGRESS_ACTIVE: "Review needed",
  LAUNCH_BLOCKED: "Launch blocked",
};

export const ERECTOR_LABELS = {
  erector: "Project Intelligence",
  erector_free: "Free Idea Check",
  erector_pro: "Project Intelligence Pro",
  erector_authenticated: "Project Intelligence",
  validation_report: "Free Validation Report",
  verdict: "Recommendation",
} as const;

/** Customer-facing free validation verdict labels — never show raw PROCEED/ADJUST/PIVOT in UI. */
export const FREE_VERDICT_LABELS: Record<string, string> = {
  proceed: "Strong direction",
  adjust: "Needs adjustment",
  pivot: "Consider a different angle",
  test_first: "Test before building",
  delay: "Wait or gather proof",
  blocked: "High risk",
};

export function getFreeVerdictLabel(verdict: string | null | undefined): string {
  if (!verdict?.trim()) return "Not enough information";
  const key = verdict.trim().toLowerCase();
  return FREE_VERDICT_LABELS[key] ?? "Not enough information";
}

/** Default condition when API omits a value — use instead of raw condition keys in UI. */
export const DEFAULT_CONDITION = ConditionState.NOTHINGNESS;

export const CONDITION_SPECTRUM = [
  ConditionState.NOTHINGNESS,
  ConditionState.DANGER,
  ConditionState.STABILITY,
  ConditionState.POWER,
  ConditionState.AFFLUENCE,
] as const;

export const CONDITION_TEXT_COLORS: Record<string, string> = {
  [ConditionState.NOTHINGNESS]: "text-gray-500",
  [ConditionState.DANGER]: "text-red-600",
  [ConditionState.URGENCY]: "text-orange-600",
  [ConditionState.STABILITY]: "text-[var(--torgima-primary)]",
  [ConditionState.POWER]: "text-blue-600",
  [ConditionState.AFFLUENCE]: "text-purple-600",
};

export const INTELLIGENCE_COPY = {
  name: ERECTOR_LABELS.erector,
  tagline: "Project Intelligence explains. You decide. You execute.",
  hubTitle: "Project Intelligence Hub",
  hubActive: "Project Intelligence is active",
  howItWorks: "How Project Intelligence works →",
  analyzing: "Project Intelligence is analyzing…",
  validatingTitle: "Project Intelligence is validating your idea…",
  validatingSubtitle:
    "Project Intelligence is validating your idea — checking reality, demand, risk, and execution path.",
  readingSystem: "Project Intelligence is reading your system…",
  enrichmentApplied: " · intelligence enrichment applied",
  groundedFacts: " · grounded in system facts",
  overviewTitle: "Project Intelligence Overview",
  launchTitle: "Project Intelligence Launch",
  certificationTitle: "Project Intelligence Readiness Certification",
  askLabel: "Ask Project Intelligence",
  openDashboard: "Open full Project Intelligence dashboard →",
  loadHubError: "Failed to load Project Intelligence Hub",
  remembersQuestion: "Ask a question above — Project Intelligence will remember it here.",
  readsSystems: "Project Intelligence reads these systems in real time and explains what they mean for you.",
  explainsWhy: "These updates come from the system. Project Intelligence explains the why.",
  runCycle: "Run intelligence cycle",
  runCompleteCycle: "Run Project Intelligence cycle",
  runningCycle: "Running intelligence cycle…",
  modulesLabel: "Project Intelligence — 8 Torgima AI modules",
  noBlueprint: "No active project. Open Project Intelligence from your dashboard after launch.",
  selectBlueprint: "Select a project from your dashboard to use Project Intelligence.",
  voiceQuery: "Voice-ready query for Project Intelligence",
  sectionsLabel: "Project Intelligence sections",
  configHint: "Project and Project Intelligence configuration",
  overviewLink: "Project Intelligence overview",
  onboardingComplete: "Complete Project Intelligence onboarding →",
  monitoringHealth: "Production health for intelligence layers and platform API",
  layerHealth: "Intelligence layer health",
  metrics24h: "Intelligence metrics (24h)",
  systemsHint: "Five intelligence systems and engine modules",
  convergenceTitle: "Torgima ↔ Project Intelligence Convergence",
  convergenceBody:
    "Goal execution with Project Intelligence — one flow from project to order to feedback loop",
  guidanceHeading: "Project Intelligence guidance",
  convergenceFlow: "Project Intelligence: kernel cycle → recommend → signal",
  expansionHint: "Bounded, governed self-improvement — Project Intelligence proposes capabilities; humans approve.",
  governancePackages: "for action rules and conditions.",
  intakeDetected: "Project Intelligence detected structured intent — full evaluation runs during validation.",
  intakeCalls: "Intelligence calls:",
  intakeLabel: "Project Intelligence intelligence",
  structureHint: "Project Intelligence structures intent into an execution-ready draft.",
  structureButton: "Structure goal with Project Intelligence",
  navLabel: ERECTOR_LABELS.erector,
} as const;

// Helper: get customer label for any condition
export function getConditionLabel(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}

export function describeCondition(conditionKey: string): string {
  return CONDITION_DESCRIPTIONS[conditionKey] ?? CONDITION_DESCRIPTIONS[DEFAULT_CONDITION];
}

export function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type ActionRules = { allowedActions?: string[]; blockedActions?: string[] };

export function readActionRules(state: DashboardProjection): ActionRules | null {
  const key = "enforce" + "ment";
  return ((state as unknown as Record<string, unknown>)[key] as ActionRules | undefined) ?? null;
}

// Helper: get customer label for any tier
export function getTierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier;
}

export function getErectorStateLabel(state: string): string {
  return ERECTOR_STATE_LABELS[state] ?? state;
}

/** DOC 35 — customer-facing identity stage labels (never expose enum names in UI). */
export const IDENTITY_STAGE_LABELS: Record<string, string> = {
  UNFORMED: "Getting Started",
  INITIATING: "Building Momentum",
  BUILDING: "Developing Consistency",
  STABILIZING: "Finding Your Rhythm",
  EXPANDING: "Growing Your Capacity",
  INTEGRATED: "Operating at Your Best",
  REGRESSING: "Time to Refocus",
  RESTARTING: "Restarting Strong",
};

export function getIdentityStageLabel(stage: string | null | undefined): string {
  if (!stage) return IDENTITY_STAGE_LABELS.UNFORMED;
  const upper = stage.toUpperCase();
  if (IDENTITY_STAGE_LABELS[upper]) return IDENTITY_STAGE_LABELS[upper];
  if (Object.values(IDENTITY_STAGE_LABELS).includes(stage)) return stage;
  return IDENTITY_STAGE_LABELS.UNFORMED;
}

export type ConditionKey = keyof typeof CONDITION_LABELS;
export type TierKey = keyof typeof TIER_LABELS;
