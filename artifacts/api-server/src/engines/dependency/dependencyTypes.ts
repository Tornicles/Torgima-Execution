/**
 * DOC26 — shared dependency types for executability and resolution.
 */

import type { DependencyType } from "./dependencyResolution.js";
import type { ResolutionTaskSpec } from "../execution-loop/DependencyEngine.js";

export type CandidateTask = {
  id?: string;
  orderId?: string;
  action_id?: string | null;
  task_type?: string | null;
  linked_phase_id?: string | null;
  trace_metadata?: Record<string, unknown> | null;
};

export type BlockingDependency = {
  type: DependencyType;
  dependencyId?: string;
  description: string;
  resolutionStrategy: string;
  blocking?: boolean;
  /** Backward-compatible alias used by DOC29 routes. */
  dependencyType?: DependencyType;
};

export type ExecutabilityResult = {
  executable: boolean;
  blockingDependencies: BlockingDependency[];
  unlock_value: number;
  /** Legacy field consumed by PriorityEngine / DOC29. */
  unlockValueScore: number;
  recommendedNextAction: "PUBLISH_TASK" | "GENERATE_RESOLUTION_TASK" | "WAIT" | "SYSTEM_REPAIR";
  resolutionTask?: ResolutionTaskSpec;
};

export type DependencyContext = {
  blueprintId: string;
  userId: string;
  candidateTaskId: string;
  orderId?: string;
};

export function normalizeBlockingDependency(dep: BlockingDependency): BlockingDependency {
  return {
    ...dep,
    dependencyType: dep.type,
    blocking: dep.blocking ?? true,
  };
}
