/**
 * DOC28 Task 3 — eight authority-based conflict resolution rules.
 */

export type ConflictContext = {
  systemHealthDegraded?: boolean;
  operationType?: "feedback" | "task_guarantee" | "recovery" | "analytics" | "bhudhi" | "projection";
  enforcementBlockedActions?: string[];
  proposedTaskType?: string;
  dependencyExecutable?: boolean;
  falseProgressActive?: boolean;
  outcomeValidationStatus?: string;
  bhudhiContextStateVersion?: number;
  currentStateVersion?: number;
  condition?: string;
  userPreferredTaskType?: string;
  externalSignalTrust?: "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
  externalSignalInternallyValidated?: boolean;
  priorityEngineFailed?: boolean;
  queueEmpty?: boolean;
  activeBlueprint?: boolean;
};

export type ConflictRuleResult = {
  rule: string;
  applied: boolean;
  action: string;
  blockOptionalAnalytics?: boolean;
  overrideTaskType?: string;
  skipPriorityEngine?: boolean;
  publishResolutionTask?: boolean;
  blockRewardCreation?: boolean;
  discardBhudhiOutput?: boolean;
  forceRecoveryTask?: boolean;
  requireInternalValidation?: boolean;
  forceTaskGuarantee?: boolean;
};

export const CONFLICT_RULES = [
  "SYSTEM_HEALTH_LOCK",
  "CONTROL_BEATS_TASK_GENERATION",
  "DEPENDENCY_BEATS_PRIORITY",
  "OUTCOME_TRUTH_BEATS_REWARD",
  "STATE_VERSION_BEATS_AI",
  "CONDITION_BEATS_USER_PREFERENCE",
  "EXTERNAL_SIGNAL_NEEDS_VALIDATION",
  "TASK_GUARANTEE_BEATS_EMPTY_QUEUE",
] as const;

function rule1(ctx: ConflictContext): ConflictRuleResult {
  const recoveryOps = new Set<ConflictContext["operationType"]>([
    "feedback",
    "task_guarantee",
    "recovery",
  ]);
  const optionalOps = new Set<ConflictContext["operationType"]>([
    "analytics",
    "bhudhi",
    "projection",
  ]);
  const applied =
    ctx.systemHealthDegraded === true &&
    !!ctx.operationType &&
    optionalOps.has(ctx.operationType) &&
    !recoveryOps.has(ctx.operationType);

  return {
    rule: "SYSTEM_HEALTH_LOCK",
    applied,
    action: applied
      ? "Pause non-recovery operations while system health is degraded"
      : "System health allows operation",
    blockOptionalAnalytics: applied,
  };
}

function rule2(ctx: ConflictContext): ConflictRuleResult {
  const blocked = ctx.enforcementBlockedActions ?? [];
  const proposed = ctx.proposedTaskType ?? "";
  const applied =
    blocked.length > 0 &&
    !!proposed &&
    blocked.some((action) => proposed.includes(action) || action.includes(proposed));

  return {
    rule: "CONTROL_BEATS_TASK_GENERATION",
    applied,
    action: applied
      ? "Task generation must choose a task type not blocked by enforcement"
      : "Proposed task type allowed by enforcement",
    overrideTaskType: applied ? "recovery" : undefined,
  };
}

function rule3(ctx: ConflictContext): ConflictRuleResult {
  const applied = ctx.dependencyExecutable === false;
  return {
    rule: "DEPENDENCY_BEATS_PRIORITY",
    applied,
    action: applied
      ? "Skip priority selection and publish dependency resolution task"
      : "Dependency path is executable",
    skipPriorityEngine: applied,
    publishResolutionTask: applied,
  };
}

function rule4(ctx: ConflictContext): ConflictRuleResult {
  const applied =
    ctx.falseProgressActive === true ||
    (ctx.outcomeValidationStatus ?? "").toUpperCase() === "FALSE_PROGRESS";
  return {
    rule: "OUTCOME_TRUTH_BEATS_REWARD",
    applied,
    action: applied
      ? "Block completion/outcome/milestone rewards until outcome truth is restored"
      : "Reward evaluation may proceed",
    blockRewardCreation: applied,
  };
}

function rule5(ctx: ConflictContext): ConflictRuleResult {
  const applied =
    ctx.bhudhiContextStateVersion != null &&
    ctx.currentStateVersion != null &&
    ctx.bhudhiContextStateVersion !== ctx.currentStateVersion;
  return {
    rule: "STATE_VERSION_BEATS_AI",
    applied,
    action: applied
      ? "Discard stale Bhudhi output and rebuild context from current state"
      : "Bhudhi context is current",
    discardBhudhiOutput: applied,
  };
}

function rule6(ctx: ConflictContext): ConflictRuleResult {
  const scalingPreference = (ctx.userPreferredTaskType ?? "").toLowerCase().includes("execution");
  const applied = ctx.condition === "danger" && scalingPreference;
  return {
    rule: "CONDITION_BEATS_USER_PREFERENCE",
    applied,
    action: applied
      ? "Present recovery task instead of scaling work under danger condition"
      : "User preference may be honored",
    forceRecoveryTask: applied,
    overrideTaskType: applied ? "recovery" : undefined,
  };
}

function rule7(ctx: ConflictContext): ConflictRuleResult {
  const applied =
    (ctx.externalSignalTrust === "HIGH" || ctx.externalSignalTrust === "VERIFIED") &&
    ctx.externalSignalInternallyValidated !== true;
  return {
    rule: "EXTERNAL_SIGNAL_NEEDS_VALIDATION",
    applied,
    action: applied
      ? "Route high-trust external signals through internal validation before outcome changes"
      : "External signal validation satisfied",
    requireInternalValidation: applied,
  };
}

function rule8(ctx: ConflictContext): ConflictRuleResult {
  const applied =
    (ctx.priorityEngineFailed === true || ctx.queueEmpty === true) &&
    ctx.activeBlueprint !== false;
  return {
    rule: "TASK_GUARANTEE_BEATS_EMPTY_QUEUE",
    applied,
    action: applied
      ? "Force task guarantee fallback so dashboard never stays empty"
      : "Queue has publishable work",
    forceTaskGuarantee: applied,
    overrideTaskType: applied ? "recovery" : undefined,
  };
}

export function resolveConflictRules(ctx: ConflictContext): ConflictRuleResult[] {
  return [
    rule1(ctx),
    rule2(ctx),
    rule3(ctx),
    rule4(ctx),
    rule5(ctx),
    rule6(ctx),
    rule7(ctx),
    rule8(ctx),
  ];
}

export function resolveTaskGenerationConflict(ctx: ConflictContext): {
  allowedTaskType: string;
  skipPriority: boolean;
  forceGuarantee: boolean;
} {
  const rules = resolveConflictRules(ctx);
  let allowedTaskType = ctx.proposedTaskType ?? "execution";
  let skipPriority = false;
  let forceGuarantee = false;

  for (const rule of rules) {
    if (rule.overrideTaskType) allowedTaskType = rule.overrideTaskType;
    if (rule.skipPriorityEngine) skipPriority = true;
    if (rule.forceTaskGuarantee) forceGuarantee = true;
    if (rule.forceRecoveryTask) allowedTaskType = "recovery";
  }

  return { allowedTaskType, skipPriority, forceGuarantee };
}

/** Backward-compatible conflict decision for SystemOrchestrationEngine. */
export function resolveEngineConflict(params: {
  engineA: string;
  engineB: string;
  conflictType: string;
}): { winner: string; loser: string; reason: string; resolution: string } {
  const resolutionMap: Record<string, string> = {
    TASK_CONFLICT: "Winner's task rules apply. Loser's task is suppressed.",
    STATE_CONFLICT: "Winner's state version wins. Loser must re-read current state.",
    PERMISSION_CONFLICT: "Winner's permission rules apply. Loser action is blocked.",
    EXECUTION_CONFLICT: "Winner's execution path is followed. Loser emits deferred event.",
  };

  const precedence: Array<[string, string, string]> = [
    ["ControlEngine", "TaskGeneration", "Tasks must obey enforcement"],
    ["DependencyEngine", "PriorityEngine", "Blocked tasks are not executable"],
    ["OutcomeValidation", "RewardEngine", "No reward for unvalidated or false progress"],
    ["StateMutationService", "BhudhiRouter", "Stale AI output is invalid"],
  ];

  const normalize = (value: string) => value.replace(/Engine$/, "").toLowerCase();
  for (const [winner, loser, reason] of precedence) {
    const a = normalize(params.engineA);
    const b = normalize(params.engineB);
    const w = normalize(winner);
    const l = normalize(loser);
    if ((a === w && b === l) || (a === l && b === w)) {
      const resolvedWinner = a === w ? params.engineA : params.engineB;
      const resolvedLoser = resolvedWinner === params.engineA ? params.engineB : params.engineA;
      return {
        winner: resolvedWinner,
        loser: resolvedLoser,
        reason,
        resolution: resolutionMap[params.conflictType] ?? resolutionMap.TASK_CONFLICT!,
      };
    }
  }

  return {
    winner: params.engineA,
    loser: params.engineB,
    reason: "No explicit precedence rule — first claimant wins",
    resolution: resolutionMap[params.conflictType] ?? resolutionMap.TASK_CONFLICT!,
  };
}
