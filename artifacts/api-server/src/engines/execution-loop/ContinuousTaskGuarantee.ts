/** Phase 1 prerequisite path — never-empty task law. */
export {
  guaranteeTask,
  ensureActiveOrder,
  diagnoseExecutionBlock,
} from "../task-guarantee/ContinuousTaskGuaranteeEngine.js";
export type {
  GuaranteeState,
  GuaranteeBlockReason,
} from "../task-guarantee/ContinuousTaskGuaranteeEngine.js";
