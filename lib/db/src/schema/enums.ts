import { pgEnum } from "drizzle-orm/pg-core";
import {
  ActionTypeValues,
  BlueprintStatusValues,
  ConditionStateValues,
  EventStatusValues,
  OrderStatusValues,
  PhaseStatusValues,
  PlanStatusValues,
  ProjectStatusValues,
  TargetStatusValues,
  ValidationKindValues,
} from "@workspace/state-machine";

// GROUP 1 — USER & SYSTEM
export const userModeEnum = pgEnum("user_mode", ["individual", "team"]);
export const userTierEnum = pgEnum("user_tier", ["starter", "growth", "ultimate"]);
export const commitmentLevelEnum = pgEnum("commitment_level", ["low", "medium", "high", "full"]);

// GROUP 2 — BLUEPRINT & EXECUTION
export const blueprintStatusEnum = pgEnum("blueprint_status", BlueprintStatusValues);
export const intelligenceDepthEnum = pgEnum("intelligence_depth", [
  "guided",
  "operational",
  "strategic",
]);
export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "strategist",
  "operator",
  "contributor",
  "reviewer",
  "observer",
]);
export const blueprintOperationalStateEnum = pgEnum("blueprint_operational_state", [
  "ACTIVE",
  "STALLED",
  "DEGRADED",
  "RECOVERY",
  "COLLAPSED",
  "ARCHIVED",
]);
export const validationVerdictEnum = pgEnum("validation_verdict", ["proceed", "adjust", "pivot"]);
export const selectedPathEnum = pgEnum("selected_path", ["current", "adjusted", "alternative"]);
export const validationReadinessEnum = pgEnum("validation_readiness", [
  "not_ready",
  "partial",
  "ready_proceed",
  "ready_with_adjustment",
  "blocked_pivot",
]);
export const validationKindEnum = pgEnum("validation_kind", ValidationKindValues);
export const domainEnum = pgEnum("domain", [
  "genesis", "market", "delivery", "operations", "people", "growth", "continuity",
]);
export const seasonNameEnum = pgEnum("season_name", ["ignition", "foundation", "traction", "scale"]);
export const planStatusEnum = pgEnum("plan_status", PlanStatusValues);
export const targetTypeEnum = pgEnum("target_type", [
  "major", "primary", "vital", "operating", "production", "conditional",
]);
export const targetStatusEnum = pgEnum("target_status", TargetStatusValues);
export const phaseNameEnum = pgEnum("phase_name", ["initiation", "development", "completion"]);
export const phaseStatusEnum = pgEnum("phase_status", PhaseStatusValues);
export const projectTypeEnum = pgEnum("project_type", [
  "setup", "execution", "analysis", "optimization", "recovery",
]);
export const projectStatusEnum = pgEnum("project_status", ProjectStatusValues);
export const actionTypeEnum = pgEnum("action_type", ActionTypeValues);

// GROUP 3 — ORDER (TASK)
export const taskTypeEnum = pgEnum("task_type", [
  "execution", "recovery", "academy", "clarification",
  "blocker_resolution", "phase_checkpoint", "habit", "review",
]);
export const difficultyEnum = pgEnum("difficulty", [
  "very_easy", "easy", "moderate", "hard", "very_hard",
]);
export const proofTypeEnum = pgEnum("proof_type", ["link", "file", "text", "image", "none"]);
export const orderStatusEnum = pgEnum("order_status", OrderStatusValues);

// GROUP 4 — SIGNAL & CONDITION
export const conditionEnum = pgEnum("condition", ConditionStateValues);
export const signalTrendEnum = pgEnum("signal_trend", [
  "rising", "stable", "declining", "recovering", "volatile",
]);
export const signalConfidenceEnum = pgEnum("signal_confidence", [
  "insufficient_data", "low", "medium", "high",
]);
export const phasePermissionEnum = pgEnum("phase_permission", [
  "restricted", "blocked", "normal", "accelerated",
]);
export const targetAdjustmentEnum = pgEnum("target_adjustment", ["reduce", "maintain", "expand"]);
export const aiModeEnum = pgEnum("ai_mode", [
  "command", "correction", "stabilization", "optimization", "expansion", "strategic", "analytical",
]);
export const uiModeEnum = pgEnum("ui_mode", [
  "starter", "restrictive", "focused", "standard", "expanded", "strategic", "transitional",
]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high", "critical"]);

// GROUP 5 — EVENT SYSTEM
export const eventStatusEnum = pgEnum("event_status", EventStatusValues);
export const eventLogResultEnum = pgEnum("event_log_result", [
  "success", "retry", "failed", "dead_lettered", "noop_duplicate",
]);

// GROUP 6 — FRAMEWORK
export const frameworkNameEnum = pgEnum("framework_name", [
  "governance_risk", "finmatrix", "strategycore", "synergyops", "talentsync",
  "alignment_accountability", "customervalue", "omnigrowth", "adaptive_intelligence",
  "knowledgeflow", "decision_velocity", "culture_dynamics", "regeneration_exit", "clarity_catalyst",
]);
export const frameworkActivationLevelEnum = pgEnum("framework_activation_level", [
  "dormant", "monitor", "diagnose", "recommend", "enforce",
]);
export const frameworkDecisionStatusEnum = pgEnum("framework_decision_status", [
  "proposed", "approved", "rejected", "applied", "superseded",
]);

// GROUP 7 — BHUDHI (AI)
export const bhudhiTriggerTypeEnum = pgEnum("bhudhi_trigger_type", [
  "task_generation", "feedback_interpretation", "feedback_interrogation",
  "goal_structuring", "validation_analysis", "condition_explanation", "state_explanation",
  "blocker_classification", "pattern_summary", "evidence_summary", "root_cause_candidates",
  "pivot_path_generation", "academy_content", "knowledge_update",
  "blueprint_generation", "blueprint_interpretation",
  "erector_analysis",
]);
export const bhudhiExecutionContextEnum = pgEnum("bhudhi_execution_context", [
  "marketing", "pr", "strategy", "execution", "analysis",
]);
export const bhudhiRequestTypeEnum = pgEnum("bhudhi_request_type", [
  "goal_validation", "blueprint_generation", "policy_generation", "task_generation",
  "task_regeneration", "feedback_interpretation", "feedback_interrogation",
  "condition_explanation", "recovery_suggestion", "academy_content",
  "knowledge_generation", "behavior_analysis", "dashboard_summary", "other",
]);

// GROUP 8 — CAPABILITY & BEHAVIOR
export const capabilityLevelEnum = pgEnum("capability_level", [
  "beginner", "operator", "advanced", "lead",
]);
export const throughputEnum = pgEnum("throughput", [
  "very_low", "low", "moderate", "high", "very_high",
]);
export const fatigueRiskEnum = pgEnum("fatigue_risk", ["low", "moderate", "high", "critical"]);
export const behaviorPatternTypeEnum = pgEnum("behavior_pattern_type", [
  "procrastination", "burnout", "inconsistency", "avoidance", "fake_completion",
  "low_reflection", "blocker_repetition", "inactivity", "score_inflation",
]);
export const behaviorPatternStatusEnum = pgEnum("behavior_pattern_status", [
  "active", "resolved", "ignored", "monitoring",
]);
export const inactivityThresholdEnum = pgEnum("inactivity_threshold", [
  "warning", "soft", "hard", "critical",
]);

// GROUP 9 — IDENTITY & ENGAGEMENT
export const identityStageEnum = pgEnum("identity_stage", [
  "starting", "forming", "building", "establishing", "consolidated", "transforming",
]);
export const milestoneTypeEnum = pgEnum("milestone_type", [
  "task_streak", "phase_complete", "project_complete", "target_hit",
  "blueprint_complete", "comeback", "score_improvement", "capability_level_up",
]);

// GROUP 10 — TASK GENERATION
export const generationTriggerEnum = pgEnum("generation_trigger", [
  "blueprint_launched", "feedback_submitted", "condition_changed", "task_completed",
  "task_blocked", "user_inactive", "phase_checkpoint_required", "academy_gap_detected",
  "weekly_review_due", "habit_check_due", "dependency_unblocked", "daily_cycle",
  "recovery_triggered", "manual_regeneration",
]);
export const generationModeEnum = pgEnum("generation_mode", [
  "initial", "post_feedback", "daily", "recovery", "condition_change",
]);
export const domainTransitionTriggerEnum = pgEnum("domain_transition_trigger", [
  "validation_complete", "blueprint_launched", "signal_change", "condition_change",
  "strategy_pivot", "manual_review", "phase_complete", "recovery_mode",
]);
