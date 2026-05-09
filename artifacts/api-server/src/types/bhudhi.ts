// ── LEGACY SHAPE (Prompts 1–5 active wiring) ─────────────────────────────────
// Used by BhudhiCore, TriggerRouter, FallbackLibrary, OutputValidator, and the
// /api/bhudhi/* routes today. Replaced/extended by the canonical shape below
// when Bhudhi gets its full implementation in Prompt 9.

export type BhudhiTrigger =
  | "goal_validation"
  | "blueprint_generation"
  | "task_generation"
  | "task_regeneration"
  | "feedback_interpretation"
  | "feedback_interrogation"
  | "condition_explanation"
  | "recovery_suggestion"
  | "dashboard_summary";

export interface BhudhiRequest {
  trigger:        BhudhiTrigger;
  userId:         string;
  context:        Record<string, unknown>;
  modelOverride?: string;
}

export interface BhudhiResponse {
  trigger:      BhudhiTrigger;
  output:       Record<string, unknown>;
  model:        string;
  tokensUsed:   number;
  latencyMs:    number;
  valid:        boolean;
  fallbackUsed: boolean;
}

export interface BhudhiLogEntry {
  id:           string;
  userId:       string;
  trigger:      BhudhiTrigger;
  model:        string;
  tokensUsed:   number;
  latencyMs:    number;
  valid:        boolean;
  fallbackUsed: boolean;
  createdAt:    string;
}

// ── CANONICAL SHAPE (Prompt 1 §types/bhudhi) ─────────────────────────────────
// The contract Bhudhi must honour everywhere it speaks. Bhudhi NEVER decides,
// mutates, or overrides — those modes are explicitly forbidden. The router
// downgrades any output produced under a forbidden mode to a fallback.

export type BhudhiMode =
  | "INTERPRET"
  | "STRUCTURE"
  | "DRAFT"
  | "EXPLAIN"
  | "SUGGEST"
  | "DECIDE"
  | "MUTATE"
  | "OVERRIDE";

export const FORBIDDEN_MODES: readonly BhudhiMode[] = ["DECIDE", "MUTATE", "OVERRIDE"];

export type BhudhiTriggerType =
  | "GOAL_STRUCTURING"
  | "TASK_DRAFTING"
  | "FEEDBACK_CLASSIFICATION"
  | "CLARIFICATION_PROMPT"
  | "RECOVERY_COPY"
  | "STATE_EXPLANATION"
  | "OUTCOME_EVIDENCE_SUMMARY"
  | "ACADEMY_SUPPORT"
  | "ROOT_CAUSE_ASSIST"
  | "INACTIVITY_RESTART";

export type BhudhiOutputType =
  | "structured_goal"
  | "task_copy"
  | "blocker_classification"
  | "clarification_request"
  | "recovery_copy"
  | "state_explanation"
  | "evidence_summary"
  | "academy_instruction"
  | "root_cause_candidates"
  | "restart_copy";

export interface BhudhiContextPacket {
  userId:                 string;
  blueprintId?:           string;
  triggerType:            BhudhiTriggerType;
  bhudhiMode:             BhudhiMode;
  stateVersion:           number;
  condition?:             string;
  enforcementPackageId?:  string;
  allowedActions:         string[];
  forbiddenActions:       string[];
  currentOrder?: {
    id:         string;
    type:       string;
    difficulty: string;
    proofType:  string;
    status:     string;
    title:      string;
  };
  userInput?:            string;
  systemFacts:           Record<string, unknown>;
  memoryContext?:        string;
  outputContractName:    string;
  maxTokens:             number;
}

export interface BhudhiOutputEnvelope<T = unknown> {
  outputType:               BhudhiOutputType;
  contractVersion:         string;
  stateVersion:            number;
  confidence:              "LOW" | "MEDIUM" | "HIGH";
  data:                    T;
  missingFields:           string[];
  warnings:                string[];
  forbiddenActionRequested: boolean;
}

export interface BhudhiTriggerRequest {
  sourceEngine:    string;
  triggerType:     BhudhiTriggerType;
  userId:          string;
  blueprintId?:    string;
  stateVersion:    number;
  userInput?:      string;
  facts?:          Record<string, unknown>;
  idempotencyKey:  string;
}

export interface BhudhiTriggerResult<T = unknown> {
  ok:              boolean;
  output?:         BhudhiOutputEnvelope<T>;
  fallbackUsed:    boolean;
  logId:           string;
  failureReason?:  string;
}
