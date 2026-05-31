import {
  db,
  actions,
  blueprints,
  enforcementPackages,
  orders,
  taskGenerationLog,
  validations,
} from "@workspace/db";
import type { validations as validationsTable } from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { invokeBhudhiModel } from "../../bhudhi/TriggerRouter.js";
import { buildOnboardingValidationResultsPayload } from "../../lib/buildOnboardingValidationResults.js";
import { userGoalFromRow, userPurposeFromRow } from "../../lib/mapValidationIntel.js";
import { logger } from "../../lib/logger.js";
import { OrderStatus } from "@workspace/state-machine";

const TASK_COUNT = 8;
const GENERATION_REASON = "blueprint_launched_initial_set";

export type GeneratedTask = {
  title: string;
  instruction: string;
  expectedOutput: string;
  definitionOfDone: string;
  timeEstimateMinutes?: number;
  milestone?: string | null;
  whyItMatters?: string | null;
};

export type GenerateInitialTasksParams = {
  blueprintId: string;
  userId: string;
  validation: typeof validationsTable.$inferSelect;
  selectedPath: "current" | "adjusted" | "alternative";
};

type InitialTaskContext = {
  goal: string;
  purpose: string;
  domain: string;
  selectedPath: string;
  verdict: string;
  realityScore: number;
  competitors: Array<Record<string, unknown>>;
  opportunities: Array<Record<string, unknown>>;
  risks: Array<Record<string, unknown>>;
  milestones: Array<Record<string, unknown>>;
  pathDescription: string;
  timeframeDays: number;
  commitmentLevel: string;
};

function buildInitialTaskPrompt(context: InitialTaskContext): string {
  return `You are Bhudhi, the execution intelligence engine for Torgima.

A user has just validated their idea and launched their blueprint. Generate exactly 8 specific, actionable execution tasks for their first week.

VALIDATION CONTEXT:
Goal: ${context.goal}
Purpose: ${context.purpose}
Domain: ${context.domain}
Selected Path: ${context.selectedPath}
Reality Score: ${context.realityScore}/100
Verdict: ${context.verdict}
Path Description: ${context.pathDescription}

TOP COMPETITORS IDENTIFIED:
${context.competitors.map((c) => `- ${String(c.name ?? "")}: ${String(c.description ?? "")}`).join("\n") || "None identified yet"}

TOP OPPORTUNITIES:
${context.opportunities.map((o) => `- ${String(o.title ?? o.name ?? "")}: ${String(o.description ?? "")}`).join("\n") || "None identified yet"}

KEY RISKS:
${context.risks.map((r) => `- ${String(r.title ?? "")}: ${String(r.description ?? "")} (${String(r.severity ?? "medium")})`).join("\n") || "None identified"}

SUCCESS MILESTONES:
${context.milestones.map((m, i) => `${i + 1}. ${String(m.title ?? m.name ?? "")} — ${String(m.timeframe ?? "")}`).join("\n") || "Not defined yet"}

RULES:
- Generate exactly 8 tasks
- Tasks must be specific to this exact goal and domain — not generic
- Each task must be completable in 30-60 minutes
- Tasks must be ordered by priority (most critical first)
- First 3 tasks must be executable today with no dependencies
- Tasks must directly move the user toward the first milestone
- Use the competitor and opportunity data to make tasks market-aware
- Difficulty: easy (this is day 1, nothingness condition)

Respond with ONLY valid JSON, no explanation, no markdown:
{
  "tasks": [
    {
      "title": "short action title",
      "instruction": "specific step-by-step instruction (2-3 sentences)",
      "expectedOutput": "what the user will have when done",
      "definitionOfDone": "one clear measurable completion condition",
      "timeEstimateMinutes": 30,
      "milestone": "which success milestone this connects to",
      "whyItMatters": "one sentence explaining the strategic reason"
    }
  ]
}`;
}

function parseBhudhiTasks(text: string): GeneratedTask[] {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(trimmed) as { tasks?: unknown[] };
  if (!Array.isArray(parsed.tasks)) return [];
  return parsed.tasks
    .map((t) => {
      const row = t as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      if (!title) return null;
      const task: GeneratedTask = {
        title,
        instruction: String(row.instruction ?? title),
        expectedOutput: String(row.expectedOutput ?? row.expected_output ?? "Completed deliverable"),
        definitionOfDone: String(row.definitionOfDone ?? row.definition_of_done ?? "Done when artifact exists"),
        timeEstimateMinutes: Number(row.timeEstimateMinutes ?? row.time_estimate_minutes ?? 30) || 30,
        milestone: row.milestone != null ? String(row.milestone) : null,
        whyItMatters: row.whyItMatters != null ? String(row.whyItMatters) : null,
      };
      return task;
    })
    .filter((t): t is GeneratedTask => t != null);
}

type FallbackParams = {
  goal: string;
  domain: string;
  selectedPath: string;
  milestones: Array<Record<string, unknown>>;
};

function generateFallbackTasks({ goal, domain, selectedPath, milestones }: FallbackParams): GeneratedTask[] {
  const domainKey =
    /agency|consult|service/i.test(domain) || /agency|consult|service/i.test(goal)
      ? "Agency"
      : "SaaS";

  const domainTasks: Record<string, GeneratedTask[]> = {
    SaaS: [
      {
        title: "Define your core feature set",
        instruction:
          "List the 3 features that solve the main problem. Write one sentence explaining each feature and why it matters.",
        expectedOutput: "A written list of 3 core features with explanations",
        definitionOfDone: "3 features defined in writing",
        timeEstimateMinutes: 30,
      },
      {
        title: "Identify your first 10 target users",
        instruction:
          "Find 10 specific people or companies who have the problem you are solving. Write their name, role, and why they need your solution.",
        expectedOutput: "A list of 10 target users with names and context",
        definitionOfDone: "10 names written with reasons",
        timeEstimateMinutes: 45,
      },
      {
        title: "Write your core value proposition",
        instruction:
          'Write one sentence: "I help [who] to [do what] without [pain]." Test it against your goal.',
        expectedOutput: "One clear value proposition statement",
        definitionOfDone: "Value proposition written and reviewed",
        timeEstimateMinutes: 20,
      },
    ],
    Agency: [
      {
        title: "Define your service offer",
        instruction:
          "Write exactly what service you provide, who it is for, what they get, and what the price is. Be specific.",
        expectedOutput: "A written service description with price",
        definitionOfDone: "Service offer documented",
        timeEstimateMinutes: 30,
      },
      {
        title: "Identify 10 potential clients",
        instruction:
          "Find 10 businesses or people who would pay for your service right now. Write their name and contact method.",
        expectedOutput: "10 potential clients listed",
        definitionOfDone: "10 names with contact info written",
        timeEstimateMinutes: 45,
      },
      {
        title: "Create your outreach message",
        instruction:
          "Write a short 3-sentence message explaining what you do, who you help, and what result they will get.",
        expectedOutput: "One outreach message ready to send",
        definitionOfDone: "Message written and reviewed",
        timeEstimateMinutes: 20,
      },
    ],
  };

  const base = domainTasks[domainKey] ?? domainTasks.SaaS;
  const universal: GeneratedTask[] = [
    {
      title: "Map your competitive advantage",
      instruction:
        "List 3 things you can do that your top competitors cannot or do not do. These are your unfair advantages.",
      expectedOutput: "3 competitive advantages written",
      definitionOfDone: "3 advantages identified and written",
      timeEstimateMinutes: 30,
    },
    {
      title: "Define your 30-day success metric",
      instruction:
        "Write one number that will prove progress in 30 days. Examples: 5 paying clients, 100 signups, 3 partnerships.",
      expectedOutput: "One measurable 30-day target",
      definitionOfDone: "Target number written",
      timeEstimateMinutes: 15,
    },
    {
      title: "Set up your execution workspace",
      instruction:
        "Create a folder, document, or tool where you will track your daily tasks and progress. Write the link or location.",
      expectedOutput: "An execution workspace created",
      definitionOfDone: "Workspace exists and location noted",
      timeEstimateMinutes: 20,
    },
    {
      title: "Write your first weekly plan",
      instruction:
        "List what you will complete this week based on your goal. Write 5 specific outcomes you will achieve by end of week.",
      expectedOutput: "A written weekly plan with 5 outcomes",
      definitionOfDone: "5 weekly outcomes written",
      timeEstimateMinutes: 25,
    },
    {
      title: "Validate your core assumption today",
      instruction:
        "Identify your biggest assumption about your idea. Find one real person to test it with. Write what they said.",
      expectedOutput: "One validation conversation completed and notes written",
      definitionOfDone: "Conversation done and response documented",
      timeEstimateMinutes: 45,
    },
  ];

  const milestoneHint =
    milestones[0]?.title != null ? String(milestones[0].title) : `First milestone (${selectedPath} path)`;
  return [...base, ...universal]
    .slice(0, TASK_COUNT)
    .map((t) => ({ ...t, milestone: t.milestone ?? milestoneHint }));
}

async function callBhudhiForTasks(prompt: string): Promise<GeneratedTask[]> {
  const result = await invokeBhudhiModel({
    provider: "claude",
    systemPrompt: "You output only valid JSON for Torgima task generation.",
    userPrompt: prompt,
    maxTokens: 4096,
    temperature: 0.4,
    timeoutMs: 8000,
  });
  return parseBhudhiTasks(result.text);
}

function priorityForIndex(index: number): number {
  if (index < 3) return 9;
  if (index < 6) return 6;
  return 4;
}

export async function generateInitialTasks(params: GenerateInitialTasksParams): Promise<number> {
  const { blueprintId, userId, validation, selectedPath } = params;

  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.generation_reason, GENERATION_REASON),
        inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
      ),
    )
    .limit(1);

  if (existing) {
    logger.info({ blueprintId }, "[InitialTasks] Foundation set already exists — skipping");
    return TASK_COUNT;
  }

  const shaped = buildOnboardingValidationResultsPayload(validation);
  const intel = shaped as Record<string, unknown>;
  const paths = (intel.paths ?? {}) as Record<string, Record<string, unknown>>;
  const pathBlock = paths[selectedPath] ?? {};

  const context: InitialTaskContext = {
    goal: userGoalFromRow(validation) || shaped.goal,
    purpose: userPurposeFromRow(validation) || shaped.purpose,
    domain: String(validation.domain ?? "general"),
    selectedPath,
    verdict: String(shaped.verdict ?? validation.verdict ?? "ADJUST"),
    realityScore: Number(shaped.realityScore ?? 58),
    competitors: (shaped.competitors as Array<Record<string, unknown>>) ?? [],
    opportunities: (shaped.opportunities as Array<Record<string, unknown>>) ?? [],
    risks: (shaped.risks as Array<Record<string, unknown>>) ?? [],
    milestones: (shaped.milestones as Array<Record<string, unknown>>) ?? [],
    pathDescription: String(pathBlock.description ?? ""),
    timeframeDays: validation.timeframe_days ?? 365,
    commitmentLevel: validation.commitment_level ?? "medium",
  };

  const prompt = buildInitialTaskPrompt(context);
  let tasks: GeneratedTask[] = [];
  let bhudhiUsed = false;

  try {
    tasks = await Promise.race([
      callBhudhiForTasks(prompt),
      new Promise<GeneratedTask[]>((_, reject) =>
        setTimeout(() => reject(new Error("Bhudhi timeout")), 8000),
      ),
    ]);
    bhudhiUsed = tasks.length > 0;
    logger.info({ blueprintId, count: tasks.length }, "[InitialTasks] Bhudhi generated tasks");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ blueprintId, message }, "[InitialTasks] Bhudhi failed, using fallback");
    tasks = generateFallbackTasks({
      goal: context.goal,
      domain: context.domain,
      selectedPath,
      milestones: context.milestones,
    });
  }

  if (tasks.length < TASK_COUNT) {
    const extras = generateFallbackTasks({
      goal: context.goal,
      domain: context.domain,
      selectedPath,
      milestones: context.milestones,
    });
    tasks = [...tasks, ...extras].slice(0, TASK_COUNT);
  }
  tasks = tasks.slice(0, TASK_COUNT);

  const [enforcement] = await db
    .select({ id: enforcementPackages.id })
    .from(enforcementPackages)
    .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)))
    .limit(1);

  await db
    .update(enforcementPackages)
    .set({ task_limits: { min: TASK_COUNT, max: TASK_COUNT } })
    .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)));

  // Only replace a prior validation initial set — never cancel hierarchy-linked launch orders.
  await db
    .update(orders)
    .set({ status: OrderStatus.CANCELLED, is_visible: false })
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        inArray(orders.status, [OrderStatus.PENDING, OrderStatus.PRE_GENERATED]),
        eq(orders.generation_reason, GENERATION_REASON),
      ),
    );

  const [bpRow] = await db
    .select({
      current_plan_id: blueprints.current_plan_id,
      current_phase_id: blueprints.current_phase_id,
      current_project_id: blueprints.current_project_id,
      current_action_id: blueprints.current_action_id,
    })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const chainActions = await db
    .select({
      id: actions.id,
      name: actions.name,
      title: actions.title,
      description: actions.description,
      project_id: actions.project_id,
      target_id: actions.target_id,
      type: actions.type,
    })
    .from(actions)
    .where(eq(actions.blueprint_id, blueprintId))
    .orderBy(asc(actions.order_index))
    .limit(TASK_COUNT);

  const domain = validation.domain ?? "general";
  const orderInserts = tasks.map((task, index) => {
    const linkedAction = chainActions[index];
    return {
    blueprint_id: blueprintId,
    user_id: userId,
    enforcement_package_id: enforcement?.id ?? null,
    action_id: linkedAction?.id ?? null,
    plan_id: bpRow?.current_plan_id ?? null,
    phase_id: bpRow?.current_phase_id ?? null,
    project_id: linkedAction?.project_id ?? bpRow?.current_project_id ?? null,
    linked_plan_id: bpRow?.current_plan_id ?? null,
    linked_target_id: linkedAction?.target_id ?? null,
    linked_phase_id: bpRow?.current_phase_id ?? null,
    linked_project_id: linkedAction?.project_id ?? bpRow?.current_project_id ?? null,
    task_type: "execution" as const,
    title: task.title,
    instruction: task.instruction,
    expected_output: task.expectedOutput,
    definition_of_done: task.definitionOfDone,
    context_why: task.whyItMatters ?? "Foundation task from your validation launch.",
    order_type: "execution",
    why_it_matters: task.whyItMatters ?? "Moves you toward your first validated milestone.",
    proof_required: false,
    difficulty: "easy" as const,
    priority: priorityForIndex(index),
    time_estimate_minutes: task.timeEstimateMinutes ?? 30,
    time_estimate_mins: task.timeEstimateMinutes ?? 30,
    status: OrderStatus.PENDING,
    condition_at_generation: "nothingness",
    domain_at_generation: domain,
    generation_reason: GENERATION_REASON,
    value_score: Math.max(10 - index, 3),
    is_visible: true,
    trace_metadata: {
      sequence_number: index + 1,
      generation_mode: "initial",
      from_validation: validation.id,
      selected_path: selectedPath,
      milestone: task.milestone ?? null,
      linked_action_sequence: index + 1,
    },
  };
  });

  const inserted = await db.insert(orders).values(orderInserts).returning({ id: orders.id });

  await db
    .insert(taskGenerationLog)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      generation_trigger: "blueprint_launched",
      generation_mode: "initial",
      condition_at_generation: "nothingness",
      enforcement_package_id: enforcement?.id ?? null,
      input_json: { validationId: validation.id, selectedPath, taskCount: TASK_COUNT },
      orders_generated: inserted.length,
      order_ids: inserted.map((r) => r.id),
      ai_used: bhudhiUsed,
      used_fallback: !bhudhiUsed,
      fallback_reason: bhudhiUsed ? null : "bhudhi_timeout_or_parse",
      generation_notes: `Initial foundation set (${inserted.length} tasks)`,
    })
    .catch(() => null);

  return inserted.length;
}
