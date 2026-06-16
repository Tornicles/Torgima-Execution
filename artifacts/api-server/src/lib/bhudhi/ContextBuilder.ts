import { bhudhiMemoryService } from "./BhudhiMemoryService.js";
import type { Doc12TriggerType } from "./TriggerRegistry.js";
import { REGISTERED_TRIGGERS } from "./TriggerRegistry.js";

const CONTEXT_ALIASES: Record<string, string[]> = {
  raw_goal: ["rawGoal", "raw_goal", "goal"],
  raw_purpose: ["rawPurpose", "raw_purpose", "purpose"],
  tier: ["tier", "blueprint_tier"],
  action_type: ["action_type", "actionType", "taskType", "task_type"],
  domain: ["domain"],
  condition: ["condition", "currentCondition"],
  blocker_description: ["blocker_description", "blockerDescription", "feedbackText", "summary"],
  task_type: ["task_type", "taskType"],
  missing_field: ["missing_field", "missingField", "requiredField", "missingContext"],
  task_title: ["task_title", "taskTitle"],
  signal_summary: ["signal_summary", "signalSummary", "weightedScore", "momentum", "trend"],
  next_action: ["next_action", "nextAction", "currentTaskTitle"],
  inactivity_type: ["inactivity_type", "inactivityType", "inactivitySeverity"],
  days_inactive: ["days_inactive", "daysInactive", "hoursInactive"],
  capability_name: ["capability_name", "capabilityName", "capabilityGap"],
  learning_type: ["learning_type", "learningType"],
  failure_evidence: ["failure_evidence", "failureEvidence", "evidence"],
  evidence_class: ["evidence_class", "evidenceClass"],
  evidence_summary: ["evidence_summary", "evidenceSummary", "submittedEvidence"],
  target_metric: ["target_metric", "targetMetric", "successMetric"],
  proof_description: ["proof_description", "proofDescription", "proofText", "proof"],
  expected_output: ["expected_output", "expectedOutput", "requiredOutput", "doneCriteria"],
  erector_archetype: ["erector_archetype", "archetype"],
  archetype_core_risk: ["archetype_core_risk", "core_risk"],
  proof_standard: ["proof_standard", "proofStandard"],
  why_it_matters_override: ["why_it_matters_override", "whyItMattersOverride"],
  policy_rules: ["policy_rules", "policyRules"],
  winning_conditions: ["winning_conditions", "winningConditions"],
};

function pickField(input: Record<string, unknown>, key: string): unknown {
  const aliases = CONTEXT_ALIASES[key] ?? [key];
  for (const alias of aliases) {
    if (input[alias] !== undefined && input[alias] !== null && input[alias] !== "") {
      return input[alias];
    }
  }
  return undefined;
}

function stripForbidden(input: Record<string, unknown>, forbidden: readonly string[]): Record<string, unknown> {
  const out = { ...input };
  for (const key of forbidden) {
    delete out[key];
    for (const [canonical, aliases] of Object.entries(CONTEXT_ALIASES)) {
      if (canonical === key || aliases.includes(key)) {
        delete out[canonical];
        for (const alias of aliases) delete out[alias];
      }
    }
  }
  return out;
}

function buildMinimizedContext(
  input: Record<string, unknown>,
  requiredContext: readonly string[],
  forbiddenContext: readonly string[],
): Record<string, unknown> {
  const sanitized = stripForbidden(input, forbiddenContext);
  const packet: Record<string, unknown> = {};

  for (const key of requiredContext) {
    const value = pickField(sanitized, key);
    if (value !== undefined) packet[key] = value;
  }

  for (const [key, value] of Object.entries(sanitized)) {
    if (!(key in packet) && value !== undefined) {
      packet[key] = value;
    }
  }

  return packet;
}

export interface Doc14ContextPacket extends Record<string, unknown> {
  memory_context: Record<string, unknown>;
  stateVersion?: number;
}

/** Builds minimized context with typed memory injection (DOC14). */
export async function buildContextPacket(params: {
  input: Record<string, unknown>;
  requiredFields: readonly string[];
  forbiddenFields: readonly string[];
  userId: string;
  blueprintId?: string;
  triggerType: Doc12TriggerType | string;
}): Promise<Doc14ContextPacket> {
  const filtered = buildMinimizedContext(params.input, params.requiredFields, params.forbiddenFields);

  let memory_context: Record<string, unknown> = {};
  if (params.blueprintId && params.userId) {
    memory_context = await bhudhiMemoryService.loadForTrigger(
      params.userId,
      params.blueprintId,
      params.triggerType,
    );
  }

  return {
    ...filtered,
    memory_context,
    stateVersion:
      typeof params.input.stateVersion === "number"
        ? params.input.stateVersion
        : typeof params.input.state_version === "number"
          ? params.input.state_version
          : undefined,
  };
}

export async function buildRouterContext(params: {
  input: Record<string, unknown>;
  triggerType: Doc12TriggerType;
  userId: string;
  blueprintId?: string;
}): Promise<Record<string, unknown>> {
  const def = REGISTERED_TRIGGERS[params.triggerType];
  return buildContextPacket({
    input: params.input,
    requiredFields: def.requiredContext,
    forbiddenFields: def.forbiddenContext,
    userId: params.userId,
    blueprintId: params.blueprintId,
    triggerType: params.triggerType,
  });
}

export const ContextBuilder = {
  build: buildMinimizedContext,
  buildContextPacket,
  buildRouterContext,
};

export { buildMinimizedContext };
