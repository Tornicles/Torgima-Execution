/**
 * Backward-compatible re-exports — canonical DOC26 implementation lives in sibling modules.
 */

export type { ExecutabilityResult } from "./ExecutabilityChecker.js";

export {
  checkExecutability,
  collectDependencyBlockedOrderIds,
  evaluateExecutabilityFromBlocks,
} from "./ExecutabilityChecker.js";

export {
  ensureResolvablePublication,
  createDependency,
} from "./DependencyEngine.js";

export {
  DEPENDENCY_TYPES,
  unlockValueForDependency,
  calculateUnlockValue,
  resolutionTaskForDependencyType,
  type DependencyType,
} from "./dependencyResolution.js";

export {
  generateResolutionTask,
  resolveBlockedExecution,
  resolutionEventForDependency,
} from "./DependencyResolver.js";
