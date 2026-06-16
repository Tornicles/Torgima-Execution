export type ProofLevel = "none" | "attempted" | "partial" | "proven";
export type BlockLevel = "soft" | "hard";
export type LearningType =
  | "CORRECTION_LEARNING"
  | "CAPABILITY_ACTIVATION"
  | "REINFORCEMENT_LEARNING"
  | "SCALING_KNOWLEDGE";

export interface CapabilityGapItem {
  capability_id: string;
  capability_name: string;
  required_proof_level: ProofLevel;
  current_proof_level: ProofLevel;
  block_level: BlockLevel;
  blocks_execution: boolean;
  academy_task_needed: boolean;
  missing_evidence: string[];
}

export interface CapabilityGapDetectionResult {
  gap_detected: boolean;
  gaps: CapabilityGapItem[];
  should_block_task_generation: boolean;
}

export interface AcademyContentSpec {
  title: string;
  explanation: string;
  learning_content: string;
  execution_task_description: string;
  proof_description: string;
  evidence_types_allowed: string[];
}

export interface AcademyProofValidationResult {
  validated: boolean;
  evidence_id: string | null;
  capability_confirmed: boolean;
  signal_validated: boolean;
}
