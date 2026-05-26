import type { CycleResult } from "../kernel/contracts/types.js";
import type { TaskFeedbackBhudhiResult } from "../integration/TorgimaIntegration.js";

export interface TorgimaBlueprintSnapshot {
  id: string;
  goal: string;
  purpose: string | null;
  domain: string | null;
  currentDomain: string | null;
  currentProjectId: string | null;
  currentActionId: string | null;
  currentCondition: string | null;
  userId: string;
}

export interface ConvergenceBlueprintContext {
  blueprintId: string;
  goal: string;
  purpose: string | null;
  timeframeDays: number | null;
  domain: string;
  phase: string;
  targetId: string | null;
  projectId: string | null;
  actionId: string | null;
}

export interface ProposedNextOrder {
  instruction: string;
  title: string;
  expectedOutput: string;
  definitionOfDone: string;
  whyItMatters: string;
  proofRequired: boolean;
  reasoning: string | null;
  confidence: number | null;
  source: "recommendation" | "strategy" | "fallback";
}

export interface ConvergenceExecuteResult {
  blueprint: TorgimaBlueprintSnapshot;
  intelligence: CycleResult;
  signal: string;
  control: string;
  proposedOrder: ProposedNextOrder;
  orderId: string | null;
  recommendation: {
    id: string;
    title: string;
    description: string;
    confidence: number;
  } | null;
}

export interface ConvergenceUnifiedState {
  blueprint: TorgimaBlueprintSnapshot;
  currentOrder: {
    id: string;
    title: string;
    instruction: string;
    expectedOutput: string;
    status: string;
  } | null;
  bhudhi: {
    signal: string;
    condition: string;
    control: string;
    recommendation: string | null;
    confidence: number | null;
    chainId: string | null;
    cycleStatus: string | null;
  };
}

export interface ConvergenceFeedbackResult {
  feedbackProcessed: boolean;
  bhudhi: TaskFeedbackBhudhiResult | null;
  convergence: ConvergenceExecuteResult;
}
