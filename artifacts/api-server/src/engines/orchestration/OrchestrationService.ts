/**
 * DOC28 — coordination facade: locks, workflows, conflicts, health.
 * Domain engines retain logic; this layer sequences and protects them.
 */

import { EventTypes } from "../../types/eventContracts.js";
import { LockManager, LOCK_SCOPE_DESCRIPTIONS, type AdvisoryLockScope } from "./LockManager.js";
import {
  WORKFLOWS,
  getWorkflow,
  listWorkflows,
  requiredCoreSteps,
  optionalSteps,
  type WorkflowRegistryName,
  type RegistryWorkflow,
  type RegistryWorkflowStep,
} from "./WorkflowRegistry.js";
import {
  CONFLICT_RULES,
  resolveConflictRules,
  resolveTaskGenerationConflict,
  resolveEngineConflict,
  type ConflictContext,
  type ConflictRuleResult,
} from "./ConflictResolver.js";
import { OrchestrationHealthMonitor, ORCHESTRATION_HEALTH_INTERVAL_MS } from "./OrchestrationHealthMonitor.js";
import {
  acquireLock as acquireEventLock,
  releaseLock as releaseEventLock,
  LOCK_MAX_TTL_SECONDS,
  type LockScope,
} from "./OrchestrationLock.js";

export {
  LockManager,
  LOCK_SCOPE_DESCRIPTIONS,
  WORKFLOWS,
  getWorkflow,
  listWorkflows,
  requiredCoreSteps,
  optionalSteps,
  CONFLICT_RULES,
  resolveConflictRules,
  resolveTaskGenerationConflict,
  resolveEngineConflict,
  OrchestrationHealthMonitor,
  ORCHESTRATION_HEALTH_INTERVAL_MS,
};
export type { AdvisoryLockScope, WorkflowRegistryName, RegistryWorkflow, ConflictContext, ConflictRuleResult };

export type WorkflowRunContext = {
  entityId: string;
  blueprintId?: string;
  userId?: string;
  workflowName: WorkflowRegistryName;
};

/** Acquire advisory + event-table locks for a canonical workflow. */
export async function acquireWorkflowLocks(ctx: WorkflowRunContext): Promise<{
  advisory: boolean;
  eventLock: boolean;
}> {
  const workflow = getWorkflow(ctx.workflowName);
  const entityId =
    workflow.lockScope === "BLUEPRINT"
      ? ctx.blueprintId ?? ctx.entityId
      : workflow.lockScope === "USER"
        ? ctx.userId ?? ctx.entityId
        : ctx.entityId;

  const [advisory, eventLock] = await Promise.all([
    LockManager.acquire(workflow.lockScope as AdvisoryLockScope, entityId),
    acquireEventLock(workflow.lockScope as LockScope, entityId, LOCK_MAX_TTL_SECONDS, {
      workflowName: workflow.name,
      blueprintId: ctx.blueprintId,
      userId: ctx.userId,
    }),
  ]);

  return { advisory, eventLock };
}

export async function releaseWorkflowLocks(ctx: WorkflowRunContext): Promise<void> {
  const workflow = getWorkflow(ctx.workflowName);
  const entityId =
    workflow.lockScope === "BLUEPRINT"
      ? ctx.blueprintId ?? ctx.entityId
      : workflow.lockScope === "USER"
        ? ctx.userId ?? ctx.entityId
        : ctx.entityId;

  await releaseEventLock(workflow.lockScope as LockScope, entityId, workflow.name);
}

/** Ordered core event chain for FEEDBACK_COMPLETION (required steps only). */
export function feedbackCompletionEventChain(): string[] {
  const workflow = WORKFLOWS.FEEDBACK_COMPLETION;
  return requiredCoreSteps(workflow).map((step) => step.emitsSuccessEvent);
}

/** Gap Fix 4 — optional Erector signal bridge step (non-blocking after signal_calculated). */
export function erectorSignalBridgeWorkflowStep(): RegistryWorkflowStep | undefined {
  return WORKFLOWS.FEEDBACK_COMPLETION.steps.find((step) => step.stepName === "erector_signal_bridge");
}

/** Optional analytics steps must not block guarantee terminal events. */
export function optionalStepsDoNotBlockGuarantee(workflow: RegistryWorkflow): boolean {
  const optional = optionalSteps(workflow);
  const terminal = new Set(workflow.terminalEvents);
  const required = requiredCoreSteps(workflow);
  const lastRequired = required[required.length - 1];
  if (!lastRequired) return true;

  return optional.every(
    (step) =>
      !terminal.has(step.emitsSuccessEvent) ||
      step.emitsSuccessEvent === EventTypes.REWARD_CREATED ||
      step.emitsSuccessEvent === EventTypes.IDENTITY_UPDATED ||
      step.emitsSuccessEvent === EventTypes.PATTERN_SCAN_REQUESTED,
  );
}

export class OrchestrationCoordinator {
  static resolveConflicts(ctx: ConflictContext): ConflictRuleResult[] {
    return resolveConflictRules(ctx);
  }

  static feedbackChain(): string[] {
    return feedbackCompletionEventChain();
  }

  static runHealthMonitor() {
    return OrchestrationHealthMonitor.runCycle();
  }
}
