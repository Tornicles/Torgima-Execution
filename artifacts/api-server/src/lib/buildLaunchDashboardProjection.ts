import { db, orders } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { OrderStatus } from "@workspace/state-machine";

const FOUNDATION_REASON = "blueprint_launched_initial_set";

export type LaunchDashboardProjection = {
  projectionId: string;
  generatedAt: string;
  freshness: "fresh";
  blueprint: {
    id: string;
    projectName?: string | null;
    goal: string;
    purpose: string;
    domain: string;
    status: string;
    currentCondition: string;
  };
  activeCondition: {
    condition: string;
    label: string;
    description: string;
    severity: string;
    allowedActions: string[];
    restrictedActions: string[];
    nextUnlockSignal: string;
    taskLimitMin: number;
    taskLimitMax: number;
    difficultyCap: string;
  };
  signals: {
    completionRate: number;
    weightedScore: number;
    momentum: number;
    trend: string;
    confidence: string;
    dataPoints: number;
    label: string;
    description: string;
  };
  orders: Array<{
    id: string;
    title: string;
    instruction: string;
    expectedOutput: string;
    definitionOfDone: string;
    whyItMatters: string | null;
    difficulty: string;
    timeEstimateMinutes: number | null;
    priority: number;
    priorityLabel: string;
    status: string;
    sequenceNumber: number;
  }>;
  totalOrders: number;
  identity: {
    stage: string;
    label: string;
    description: string;
  };
  validationInsights: {
    goal: string;
    verdict: string;
    realityScore: number | null;
    selectedPath: string;
  };
};

function priorityLabel(priority: number): string {
  if (priority >= 9) return "High";
  if (priority >= 6) return "Medium";
  return "Standard";
}

export async function buildLaunchDashboardProjection(params: {
  userId: string;
  blueprintId: string;
  projectName?: string | null;
  goal: string;
  purpose: string;
  domain: string;
  verdict: string | null;
  realityScore: number | null;
  selectedPath: string;
  taskLimitMin?: number;
  taskLimitMax?: number;
  difficultyCap?: string;
}): Promise<LaunchDashboardProjection> {
  const rows = await db
    .select({
      id: orders.id,
      title: orders.title,
      instruction: orders.instruction,
      expected_output: orders.expected_output,
      definition_of_done: orders.definition_of_done,
      why_it_matters: orders.why_it_matters,
      difficulty: orders.difficulty,
      time_estimate_minutes: orders.time_estimate_minutes,
      priority: orders.priority,
      status: orders.status,
      trace_metadata: orders.trace_metadata,
    })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, params.blueprintId),
        eq(orders.user_id, params.userId),
        eq(orders.generation_reason, FOUNDATION_REASON),
        inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
      ),
    )
    .orderBy(desc(orders.priority));

  const mapped = rows.map((row, index) => {
    const meta = (row.trace_metadata ?? {}) as { sequence_number?: number };
    return {
      id: row.id,
      title: row.title,
      instruction: row.instruction,
      expectedOutput: row.expected_output,
      definitionOfDone: row.definition_of_done,
      whyItMatters: row.why_it_matters,
      difficulty: row.difficulty ?? "easy",
      timeEstimateMinutes: row.time_estimate_minutes,
      priority: row.priority,
      priorityLabel: priorityLabel(row.priority),
      status: row.status,
      sequenceNumber: meta.sequence_number ?? index + 1,
    };
  });

  const min = params.taskLimitMin ?? 8;
  const max = params.taskLimitMax ?? 8;

  return {
    projectionId: `launch-${params.blueprintId}`,
    generatedAt: new Date().toISOString(),
    freshness: "fresh",
    blueprint: {
      id: params.blueprintId,
      projectName: params.projectName ?? null,
      goal: params.goal,
      purpose: params.purpose,
      domain: params.domain,
      status: "active",
      currentCondition: "nothingness",
    },
    activeCondition: {
      condition: "nothingness",
      label: "NOTHINGNESS",
      description:
        "You are starting fresh. The system has no execution history yet. Complete your first tasks to begin building momentum.",
      severity: "neutral",
      allowedActions: ["start_task", "view_task", "submit_feedback"],
      restrictedActions: [],
      nextUnlockSignal: "Complete your first task and submit feedback",
      taskLimitMin: min,
      taskLimitMax: max,
      difficultyCap: params.difficultyCap ?? "easy",
    },
    signals: {
      completionRate: 0,
      weightedScore: 0,
      momentum: 0,
      trend: "none",
      confidence: "insufficient_data",
      dataPoints: 0,
      label: "No Data Yet",
      description: "Signal data will appear after your first task completion.",
    },
    orders: mapped,
    totalOrders: mapped.length,
    identity: {
      stage: "UNFORMED",
      label: "Starting Out",
      description: "Your execution identity is forming. Complete your first tasks to begin.",
    },
    validationInsights: {
      goal: params.goal,
      verdict: params.verdict ?? "ADJUST",
      realityScore: params.realityScore,
      selectedPath: params.selectedPath,
    },
  };
}
