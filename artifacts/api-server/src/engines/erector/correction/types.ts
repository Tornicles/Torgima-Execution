export type CorrectionType =
  | "VALIDATION_ADJUST"
  | "PIVOT_REQUIRED"
  | "FALSE_PROGRESS"
  | "CONTRADICTION"
  | "ACADEMY_PROOF_FAILURE"
  | "PHASE_GATE_BLOCK"
  | "ECONOMIC_MODEL_FAILURE";

export interface CorrectionPathInput {
  userId: string;
  blueprintId?: string | null;
  validationRunId?: string | null;
  sourceEngine: string;
  sourceId: string;
  correctionType: CorrectionType;
  blockedAction: string;
  reason: string;
  userVisibleReason: string;
  requiredActions: string[];
  requiredEvidence?: string[];
  revalidationRequired?: boolean;
  unblockCondition: string;
  auditId?: string | null;
}

export interface CorrectionPathRecord {
  id: string;
  user_id: string;
  blueprint_id: string | null;
  validation_run_id: string | null;
  source_engine: string;
  source_id: string;
  correction_type: CorrectionType;
  blocked_action: string;
  reason: string;
  user_visible_reason: string;
  required_actions: string[];
  required_evidence: string[];
  revalidation_required: boolean;
  unblock_condition: string;
  status: string;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
}

export interface CorrectionPathCustomerView {
  id: string;
  what_is_blocked: string;
  why_blocked: string;
  what_to_do: string[];
  proof_needed: string[];
  progress_hint: string;
  status: string;
}

export interface EconomicCorrectionSpec {
  core_correction: string;
  required_actions: string[];
  required_evidence: string[];
  user_visible_reason: string;
  unblock_condition: string;
  revalidation_required: boolean;
}

export interface PhaseGateCriterionResult {
  criterion_id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export type PhaseGateResultStatus = "PASSED" | "PARTIAL" | "BLOCKED";

export interface PhaseGateResult {
  phase_gate_id: string;
  gate_result: PhaseGateResultStatus;
  readiness_score: number;
  criteria_results: PhaseGateCriterionResult[];
  blocking_reasons: string[];
  correction_path_id?: string;
}
