import type { EventType } from "../../types/eventContracts.js";

/**
 * Prompt 5 — canonical structured Erector Reality Package.
 * Stored as JSON (db: erector_reality_packages.package_json).
 */
export type ErectorRealityPackage = {
  identity: {
    blueprint_id: string;
    user_id: string;
    tier: string | null;
    generated_at: string;
    model_version: string;
    validation_run_id?: string | null;
    intake_session_id?: string | null;
    trigger_event_type?: EventType | null;
    trigger_event_id?: string | null;
  };
  goal_baseline: {
    refined_goal: string | null;
    purpose_summary: string | null;
    success_definition: string | null;
    failure_definition: string | null;
    scope_boundaries: string[]; // may be empty
  };
  market_baseline: {
    market_type: string | null;
    demand_level: string | null;
    competition_level: string | null;
    saturation_level: string | null;
    target_user: string | null;
    customer_pain: string | null;
    differentiation_angle: string | null;
    demand_proof_required: boolean;
  };
  economy_baseline: {
    country: string | null;
    location: string | null;
    economy_type: string | null;
    economic_constraints: string[];
    payment_constraints: string[];
    infrastructure_constraints: string[];
    regulatory_flags: string[];
  };
  execution_baseline: {
    execution_difficulty: string | null;
    required_resources: string[];
    missing_resources: string[];
    capability_gaps: string[];
    workload_realism: string | null;
    timeline_realism: string | null;
    critical_dependencies: string[];
  };
  archetype_baseline: {
    erector_archetype: string;
    archetype_confidence: number;
    archetype_rule_pack_id: string | null;
    archetype_risks: string[];
    archetype_success_patterns: string[];
    archetype_false_progress_patterns: string[];
  };
  risk_baseline: {
    execution_risks: string[];
    market_risks: string[];
    distribution_risks: string[];
    financial_risks: string[];
    capability_risks: string[];
    dependency_risks: string[];
    systemic_risks: string[];
  };
  strategy_baseline: {
    current_path: string | null;
    adjusted_path: string | null;
    alternative_path: string | null;
    recommended_path: string | null;
    strategic_constraints: string[];
    first_90_day_focus: string[];
  };
  blueprint_generation_inputs: {
    plan_modifiers: string[];
    target_modifiers: string[];
    phase_modifiers: string[];
    project_modifiers: string[];
    action_modifiers: string[];
    task_generation_constraints: string[];
    knowledge_requirements: string[];
    proof_requirements: string[];
    signal_watchpoints: string[];
    condition_sensitivity: string | null;
  };
  report_baseline: {
    executive_summary: string | null;
    validation_summary: string | null;
    simulation_summary: string | null;
    recommendation_summary: string | null;
  };
};

