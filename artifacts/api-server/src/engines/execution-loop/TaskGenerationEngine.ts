/** Phase 1 prerequisite path (spec: engines/task/ — mirrored under execution-loop). */
export {
  generate,
  TaskGenerationEngine,
  buildFallbackTaskContent,
  buildDeterministicTaskCopy,
  ensureTaskContentFields,
  DIFFICULTY_ORDER,
} from "../task-generation/TaskGenerationEngine.js";
export type { GenerationResult } from "../task-generation/TaskGenerationEngine.js";
