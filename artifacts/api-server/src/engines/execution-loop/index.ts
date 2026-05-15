/** Prompt 5 execution loop — public surface (engines live in domain folders). */
export { enterLoop, ExecutionLoopEngine, type LoopEntryParams, type LoopEntryTrigger } from "./ExecutionLoopEngine.js";
export { runDailyLoopForBlueprint, runDailyLoopsForAllActiveBlueprints, startDailyLoopScheduler } from "./DailyLoopEngine.js";
export { processFeedback } from "../feedback/FeedbackProcessingEngine.js";
export { answerInterrogation } from "../feedback/InterrogationService.js";
export { calculate } from "../signal/SignalCalculationEngine.js";
export { evaluate as evaluateCondition } from "../condition/ConditionEvaluationEngine.js";
export { generateEnforcementPackage as applyControl } from "../control/ControlEngine.js";
export { generate as generateTask } from "../task-generation/TaskGenerationEngine.js";
export { guaranteeTask } from "../task-guarantee/ContinuousTaskGuaranteeEngine.js";
export { scanForInactivity } from "../inactivity/InactivityDetectionEngine.js";
export { checkExecutability } from "../dependency/DependencyMappingEngine.js";
export { detectFriction } from "../friction/FrictionDetectionEngine.js";
export { scoreAndRankOrders as scoreCandidates } from "../priority/RealTimePriorityEngine.js";
