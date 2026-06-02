/**
 * Phase 5 / DOC 23 — audit trail for significant system decisions.
 * Facade over decision_traces persistence; engines call this instead of ad-hoc inserts.
 */

import {
  traceDecision,
  traceControlOutput,
  traceFailureRouting,
  tracePrioritySelection,
  getBlueprintStateVersion,
  IL4_DECISION_TYPES,
} from "../engines/decision-trace/DecisionTraceSystem.js";

export { IL4_DECISION_TYPES };

export const DECISION_TRACE_TYPES = {
  TASK_GENERATION: "TASK_GENERATION",
  CONDITION_CHANGE: "CONDITION_CHANGE",
  ENFORCEMENT_UPDATE: "ENFORCEMENT_UPDATE",
  FAILURE_CLASSIFICATION: "FAILURE_CLASSIFICATION",
  PATTERN_DETECTION: "PATTERN_DETECTION",
  OUTCOME_VALIDATION: "OUTCOME_VALIDATION",
  IDENTITY_CHANGE: "IDENTITY_CHANGE",
  PRIORITY_SELECTION: "PRIORITY_SELECTION",
  CONTROL_OUTPUT: "CONTROL_OUTPUT",
  FAILURE_ROUTING: "FAILURE_ROUTING",
} as const;

export type DecisionTraceType = (typeof DECISION_TRACE_TYPES)[keyof typeof DECISION_TRACE_TYPES];

export interface DecisionTraceData {
  id?: string;
  userId: string;
  blueprintId?: string;
  decisionType: DecisionTraceType;
  sourceEngine: string;
  inputsSummary: Record<string, unknown>;
  reasoningChain: Array<{ step: string; result: string }>;
  outputAction: string;
  confidence: number;
  stateVersion: number;
  causationEventId?: string;
  createdAt?: Date;
}

const DIFFICULTY_LOAD_FACTOR: Record<string, number> = {
  very_easy: 1.0,
  easy: 1.0,
  moderate: 1.5,
  hard: 2.0,
  very_hard: 3.0,
};

/** DOC 23 — cognitive load on enforcement package (0–100). */
export function computeEnforcementCognitiveLoadScore(params: {
  activeOrderCount: number;
  taskMax: number;
  difficultyCap: string;
}): number {
  const difficultyFactor = DIFFICULTY_LOAD_FACTOR[params.difficultyCap] ?? 1.5;
  const raw =
    (params.activeOrderCount / Math.max(params.taskMax, 1)) * difficultyFactor * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export async function recordDecisionTrace(data: DecisionTraceData): Promise<string> {
  const rationale = data.reasoningChain.map((s) => `${s.step}: ${s.result}`).join(" | ");
  return traceDecision({
    blueprintId: data.blueprintId ?? "",
    userId: data.userId,
    decisionType: data.decisionType,
    contextType: data.sourceEngine,
    contextId: data.causationEventId,
    engineSource: data.sourceEngine,
    inputSummary: JSON.stringify(data.inputsSummary).slice(0, 2000),
    outputSummary: data.outputAction,
    rationale: rationale || data.outputAction,
    outcome: data.outputAction,
    alternativesConsidered: data.reasoningChain,
    stateVersion: data.stateVersion,
  });
}

export async function traceTaskGenerationMode(params: {
  blueprintId: string;
  userId: string;
  generationMode: string;
  generationTrigger: string;
  selectedTaskType: string;
  candidatesConsidered: string[];
  causationEventId?: string;
}): Promise<string> {
  const stateVersion = await getBlueprintStateVersion(params.blueprintId);
  return recordDecisionTrace({
    userId: params.userId,
    blueprintId: params.blueprintId,
    decisionType: DECISION_TRACE_TYPES.TASK_GENERATION,
    sourceEngine: "TaskGenerationEngine",
    inputsSummary: {
      generation_mode: params.generationMode,
      generation_trigger: params.generationTrigger,
      candidates: params.candidatesConsidered,
    },
    reasoningChain: [
      { step: "mode", result: params.generationMode },
      { step: "trigger", result: params.generationTrigger },
      { step: "priority", result: params.selectedTaskType },
    ],
    outputAction: `task_type:${params.selectedTaskType}`,
    confidence: 0.85,
    stateVersion,
    causationEventId: params.causationEventId,
  });
}

export async function traceConditionEvaluation(params: {
  blueprintId: string;
  userId: string;
  previousCondition: string;
  newCondition: string;
  escalationLevel: number;
  recoveryRequired: boolean;
  causationEventId?: string;
}): Promise<string> {
  const stateVersion = await getBlueprintStateVersion(params.blueprintId);
  return recordDecisionTrace({
    userId: params.userId,
    blueprintId: params.blueprintId,
    decisionType: DECISION_TRACE_TYPES.CONDITION_CHANGE,
    sourceEngine: "ConditionEvaluationEngine",
    inputsSummary: {
      previous: params.previousCondition,
      escalation_level: params.escalationLevel,
      recovery_required: params.recoveryRequired,
    },
    reasoningChain: [
      { step: "previous", result: params.previousCondition },
      { step: "evaluated", result: params.newCondition },
    ],
    outputAction: `condition:${params.newCondition}`,
    confidence: 0.9,
    stateVersion,
    causationEventId: params.causationEventId,
  });
}

export {
  traceControlOutput,
  traceFailureRouting,
  tracePrioritySelection,
  getBlueprintStateVersion,
};
