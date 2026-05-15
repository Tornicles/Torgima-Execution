/**
 * Command-order wording helper. Trace chains and progression truth are assembled
 * server-side from blueprint linkage — Bhudhi only supplies language variants.
 */

export interface CommandTraceChain {
  task: string;
  action: string;
  project: string;
  phase: string;
  plan: string;
  goal: string;
}

export interface CommandOrderContent {
  command: string;
  why: string;
  where: string;
  how: string;
  requiredOutput: string;
  proof: string;
  doneCriteria: string;
  unlockConsequence: string;
  traceChain: CommandTraceChain;
  aiPromptIfNeeded?: string | null;
  platformIfNeeded?: string | null;
}

export function buildServerTraceChain(params: {
  taskTitle: string;
  actionTitle: string;
  projectTitle: string;
  phaseTitle: string;
  planTitle: string;
  goal: string;
}): CommandTraceChain {
  return {
    task: params.taskTitle,
    action: params.actionTitle,
    project: params.projectTitle,
    phase: params.phaseTitle,
    plan: params.planTitle,
    goal: params.goal,
  };
}

/** Deterministic wording when Bhudhi is unavailable. */
export class CommandOrderIntelligenceEngine {
  static deterministicFallback(params: {
    taskTitle: string;
    domain: string;
    actionTitle: string;
    projectTitle: string;
    phaseTitle: string;
    planTitle: string;
    goal: string;
    timeEstimateMinutes: number;
  }): CommandOrderContent {
    const domainPlatforms: Record<string, string> = {
      genesis: "Your primary notebook, calendar, or shipping surface",
      market: "Your customer-facing channel or outbound stack",
      delivery: "Your core delivery / communication toolchain",
      continuity: "Your maintenance, metric, or reflection systems",
      business: "Your primary operational stack or customer channel",
      technology: "Your repository, IDE, CI, or hosting surface",
      health: "Your tracking modality or training environment",
      financial: "Your ledger, brokerage, or cashflow tooling",
      creative: "Your studio or publishing surface",
      personal_growth: "Your deliberate practice or learning environment",
    };
    const d = params.domain?.toLowerCase() ?? "genesis";
    return {
      command: `Execute now: ${params.taskTitle}. This is an execution order — not a suggestion — complete inside ${params.timeEstimateMinutes} minutes or document precise blockers in feedback.`,
      why: `This order exists because ${params.actionTitle} gates ${params.projectTitle}. ${params.phaseTitle} progression depends on real motion; goal anchor: "${params.goal}".`,
      where: domainPlatforms[d] ?? "The operational environment aligned to your active domain",
      how: `Use the most direct compliant path allowed by your blueprint. If blocked >10 minutes, capture the blocker and submit feedback — speed of honest reporting beats stalled perfection.`,
      requiredOutput: `Measurable artifact evidencing completion of "${params.taskTitle}".`,
      proof: "Screenshot, outbound link, or timestamped artefact grounded in observable action.",
      doneCriteria:
        "(1) Physical/external motion occurred beyond planning. (2) Proof artefact referenced. (3) Narrative cites what materially changed.",
      unlockConsequence: `Maintains forward pressure on ${params.projectTitle} inside ${params.phaseTitle} without inventing phantom unlock semantics.`,
      traceChain: buildServerTraceChain({
        taskTitle: params.taskTitle,
        actionTitle: params.actionTitle,
        projectTitle: params.projectTitle,
        phaseTitle: params.phaseTitle,
        planTitle: params.planTitle,
        goal: params.goal,
      }),
      aiPromptIfNeeded: null,
      platformIfNeeded: null,
    };
  }
}
