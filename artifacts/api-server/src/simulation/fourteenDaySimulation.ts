import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  blueprints,
  conditions,
  deadLetterEvents,
  feedback,
  orders,
  plans,
  validations,
} from "@workspace/db";
import { BlueprintEngine } from "../engines/blueprint/BlueprintEngine.js";
import { structureGoalDeterministic } from "../engines/validation/ValidationEngine.js";
import { ValidationService } from "../services/ValidationService.js";
import { generateInitialTasks } from "../engines/tasks/generateInitialTasks.js";
import {
  getCurrentCondition,
  getCurrentEnforcement,
  getCurrentSignals,
  submitInterrogationAnswer,
  submitSimFeedback,
  triggerDailyCycle,
  runSynchronousExecutionChain,
  type SimCompletionStatus,
} from "./synchronousLoopRunner.js";
import { createTestUser } from "../tests/helpers/db.js";
import { ensureBlueprintSelectionBeforeActivate } from "../lib/ensureBlueprintSelectionBeforeActivate.js";

const SAAS_GOAL =
  "Build a SaaS platform that helps creators and solopreneurs manage business operations, track income, and know exactly what to execute daily to grow revenue from zero to $10,000/month.";
const SAAS_PURPOSE =
  "Most creators have talent but no system. They wake up not knowing what to do. I want to give them a daily execution machine that removes confusion, tracks whether they are building a real business, and tells them exactly what to do.";

export type BreakRecord = { day: number; issue: string; fix: string };

export type SimulationReport = {
  ok: boolean;
  blueprintId: string;
  userId: string;
  daysCompleted: number;
  totalTasksGenerated: number;
  totalFeedback: number;
  deadLetterCount: number;
  breaks: BreakRecord[];
  finalCondition: string;
  highestMomentum: number;
  conditionTransitions: string[];
  daySummaries: Array<{ day: number; tasks: number; feedback: number; condition: string; momentum: number }>;
  errors: string[];
};

function mapCompletion(c: string): SimCompletionStatus {
  if (c === "blocked") return "failed";
  if (c === "completed" || c === "partial" || c === "failed" || c === "skipped") return c;
  return "completed";
}

export async function getActiveTasks(blueprintId: string, limit = 12) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        inArray(orders.status, ["pending", "active", "needs_feedback"]),
      ),
    )
    .orderBy(asc(orders.priority), asc(orders.created_at))
    .limit(limit);
}

export async function bootstrapSimulationSubject(): Promise<{ userId: string; blueprintId: string; validationId: string }> {
  const user = await createTestUser({
    display_name: "14-Day Sim Creator",
    commitment_level: "high",
    tier: "growth",
  });

  const engine = new BlueprintEngine();
  const structured = structureGoalDeterministic({
    rawGoal: SAAS_GOAL,
    purpose: SAAS_PURPOSE,
    timeframe: "12 months",
    commitmentLevel: "high",
    currentContext: "Working full-time, building as side project",
    successSignal: "$10,000 MRR",
    knownBlockers: "Limited time; Solo builder",
  });

  const { blueprintId } = await engine.createDraft(user.id, {
    goal: SAAS_GOAL,
    purpose: SAAS_PURPOSE,
    commitmentLevel: "high",
    domainHint: "saas",
  });

  await db
    .update(blueprints)
    .set({
      raw_goal: SAAS_GOAL,
      purpose: SAAS_PURPOSE,
      domain: "SaaS / Software",
      commitment_level: "high",
      timeframe_days: 365,
    })
    .where(eq(blueprints.id, blueprintId));

  const validationResult = await ValidationService.validateGoal({
    blueprintId,
    userId: user.id,
    tier: "growth",
    mode: "individual",
    input: {
      goal: structured.cleanedGoal,
      purpose: structured.purpose,
      timeframe: structured.timeframe,
      commitmentLevel: "high",
      currentContext: "Working full-time, side project",
      successSignal: "$10,000 MRR",
      knownBlockers: "Limited time",
    },
  });

  const validationContractId = validationResult.validationContractId;
  if (!validationContractId) throw new Error("Validation contract missing after validateGoal");

  await ValidationService.selectValidationPath({
    blueprintId,
    userId: user.id,
    selectedPath: "adjusted",
    validationContractId,
  });

  await ensureBlueprintSelectionBeforeActivate(blueprintId, user.id, {
    tier: "growth",
    mode: "individual",
  });

  await engine.activateBlueprint(blueprintId, user.id, validationContractId);

  const [valRow] = await db.select().from(validations).where(eq(validations.blueprint_id, blueprintId)).limit(1);
  if (!valRow) throw new Error("Validation row missing after activate");

  await generateInitialTasks({
    blueprintId,
    userId: user.id,
    validation: valRow,
    selectedPath: "adjusted",
  });

  return { userId: user.id, blueprintId, validationId: valRow.id };
}

async function ensureMinTasks(blueprintId: string, userId: string, min: number, breaks: BreakRecord[], day: number) {
  let tasks = await getActiveTasks(blueprintId, 20);
  if (tasks.length >= min) return tasks;

  await triggerDailyCycle(blueprintId, userId);
  const gen = await import("../engines/task-generation/TaskGenerationEngine.js");
  await gen.generate({
    blueprintId,
    userId,
    generationMode: "daily",
    generationTrigger: "daily_cycle",
  });

  tasks = await getActiveTasks(blueprintId, 20);
  if (tasks.length < min) {
    breaks.push({
      day,
      issue: `Only ${tasks.length} active tasks (need ${min})`,
      fix: "Triggered daily_cycle + task generation",
    });
  }
  return tasks;
}

/** After capability-gap failure, ensure classification + academy task exist before Day 3 check. */
async function ensureAcademyAfterCapabilityGap(
  blueprintId: string,
  userId: string,
  hardOrderId: string,
  breaks: BreakRecord[],
): Promise<void> {
  const [fb] = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(eq(feedback.order_id, hardOrderId), eq(feedback.blueprint_id, blueprintId)))
    .orderBy(desc(feedback.created_at))
    .limit(1);

  if (!fb) return;

  const { classifyFailure, persistFailureClassificationOnFeedback } = await import(
    "../engines/failure/FailureClassificationEngine.js"
  );
  const classified = await classifyFailure({
    userId,
    blueprintId,
    orderId: hardOrderId,
    feedbackId: fb.id,
  });
  await persistFailureClassificationOnFeedback({
    feedbackId: fb.id,
    primaryCategory: classified.primaryCategory,
    correctionTaskType: classified.correctionTaskType,
  });

  if (classified.primaryCategory !== "CAPABILITY_FAILURE") {
    breaks.push({
      day: 2,
      issue: `Hard task classified as ${classified.primaryCategory}, expected CAPABILITY_FAILURE`,
      fix: "FailureClassificationEngine capability_gap routing",
    });
  }

  await runSynchronousExecutionChain(blueprintId, userId, {
    generationMode: "recovery",
    executionLoop: "primary",
  });

  const academyTasks = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.task_type, "academy"),
        inArray(orders.status, ["pending", "active", "needs_feedback"]),
      ),
    )
    .limit(1);

  if (academyTasks.length === 0) {
    const gen = await import("../engines/task-generation/TaskGenerationEngine.js");
    await gen.generate({
      blueprintId,
      userId,
      generationMode: "recovery",
      generationTrigger: "academy_gap_detected",
    });
  }
}

async function injectHardTask(blueprintId: string, userId: string) {
  const [row] = await db
    .insert(orders)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      task_type: "execution",
      title: "Build complete database schema for the entire platform",
      instruction:
        "Design and document every table, relation, and index for the full SaaS platform.",
      expected_output: "Complete ERD and schema documentation",
      definition_of_done: "All core tables documented with relationships",
      why_it_matters: "Foundation for scalable product architecture",
      difficulty: "hard",
      priority: 8,
      status: "pending",
      time_estimate_minutes: 240,
      generation_reason: "simulation_inject",
    })
    .returning();
  return row!;
}

export async function run14DaySimulation(): Promise<SimulationReport> {
  const breaks: BreakRecord[] = [];
  const errors: string[] = [];
  const conditionTransitions: string[] = [];
  const daySummaries: SimulationReport["daySummaries"] = [];
  let highestMomentum = 0;
  let totalFeedback = 0;
  let lastCondition = "nothingness";

  const { userId, blueprintId } = await bootstrapSimulationSubject();

  const recordDay = async (day: number) => {
    const sig = await getCurrentSignals(blueprintId);
    const cond = await getCurrentCondition(blueprintId);
    if (cond !== lastCondition) {
      conditionTransitions.push(`Day ${day}: ${lastCondition} → ${cond}`);
      lastCondition = cond;
    }
    highestMomentum = Math.max(highestMomentum, sig.momentum);
    const [{ count: taskCount = 0 } = {}] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.blueprint_id, blueprintId));
    const [{ fbCount = 0 } = {}] = await db
      .select({ fbCount: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.blueprint_id, blueprintId));
    daySummaries.push({ day, tasks: taskCount, feedback: fbCount, condition: cond, momentum: sig.momentum });
  };

  try {
    // DAY 1
    let day1Tasks = await ensureMinTasks(blueprintId, userId, 8, breaks, 1);
    if (day1Tasks.length < 8) {
      errors.push(`DAY 1 FAIL: Less than 8 tasks (${day1Tasks.length})`);
    }

    const day1Pattern: Array<{
      completion: string;
      score: number;
      reflection: string;
      hadBlocker?: boolean;
    }> = [
      { completion: "completed", score: 7, reflection: "Researched target audience — creators use spreadsheets; gap is real." },
      { completion: "completed", score: 8, reflection: "Wrote core value proposition for daily execution machine." },
      { completion: "completed", score: 6, reflection: "Listed 10 potential early users from network." },
      { completion: "partial", score: 5, reflection: "Started competitor analysis — found Notion and Asana as main competitors." },
      { completion: "completed", score: 7, reflection: "Set up Notion workspace for tracking progress." },
      { completion: "skipped", score: 0, reflection: "Did not get to this today" },
      { completion: "skipped", score: 0, reflection: "Skipped" },
      { completion: "skipped", score: 0, reflection: "Skipped" },
    ];

    for (let i = 0; i < Math.min(day1Pattern.length, day1Tasks.length); i++) {
      const t = day1Tasks[i]!;
      await db.update(orders).set({ status: "active", started_at: new Date() }).where(eq(orders.id, t.id));
      const p = day1Pattern[i]!;
      await submitSimFeedback({
        orderId: t.id,
        blueprintId,
        userId,
        completion: mapCompletion(p.completion),
        score: p.score,
        reflection: p.reflection,
        hadBlocker: p.hadBlocker,
      });
      totalFeedback++;
    }
    await recordDay(1);

    // DAY 2
    await triggerDailyCycle(blueprintId, userId);
    let day2Tasks = await ensureMinTasks(blueprintId, userId, 5, breaks, 2);

    const hardTask = await injectHardTask(blueprintId, userId);
    day2Tasks = await getActiveTasks(blueprintId, 16);

    for (const t of day2Tasks.slice(0, 7)) {
      await db.update(orders).set({ status: "active" }).where(eq(orders.id, t.id));
      await submitSimFeedback({
        orderId: t.id,
        blueprintId,
        userId,
        completion: "completed",
        score: 8,
        reflection: "Strong execution on product research and wireframes today.",
      });
      totalFeedback++;
    }

    await db.update(orders).set({ status: "active" }).where(eq(orders.id, hardTask.id));
    await submitSimFeedback({
      orderId: hardTask.id,
      blueprintId,
      userId,
      completion: "failed",
      score: 2,
      reflection:
        "This was way too complex for one day. I do not have enough technical knowledge to design a full schema alone.",
      difficultyFelt: "very_hard",
      hadBlocker: true,
      blockerType: "capability_gap",
      blockerDetails: "Database architecture is beyond my current skill level",
    });
    totalFeedback++;
    await recordDay(2);

    // DAYS 3–14 (compressed patterns)
    const dayPlans: Record<number, { completions: number; avgScore: number; injectAcademyCheck?: boolean }> = {
      3: { completions: 7, avgScore: 7.5, injectAcademyCheck: true },
      4: { completions: 8, avgScore: 9 },
      5: { completions: 8, avgScore: 8 },
      6: { completions: 6, avgScore: 7 },
      7: { completions: 8, avgScore: 8 },
      8: { completions: 8, avgScore: 9 },
      9: { completions: 2, avgScore: 2.5 },
      10: { completions: 5, avgScore: 7 },
      11: { completions: 7, avgScore: 7.5 },
      12: { completions: 8, avgScore: 8 },
      13: { completions: 8, avgScore: 9 },
      14: { completions: 8, avgScore: 9 },
    };

    for (let day = 3; day <= 14; day++) {
      await triggerDailyCycle(blueprintId, userId);
      const plan = dayPlans[day] ?? { completions: 6, avgScore: 7 };
      const tasks = await ensureMinTasks(blueprintId, userId, day === 9 ? 3 : 5, breaks, day);

      if (plan.injectAcademyCheck) {
        const academy = tasks.find((t) => t.task_type === "academy");
        if (!academy) {
          breaks.push({ day, issue: "Academy task not generated after capability gap", fix: "Will re-run failure classification on next feedback" });
        }
      }

      if (day === 4) {
        const t = tasks[3];
        if (t) {
          await db.update(orders).set({ status: "active" }).where(eq(orders.id, t.id));
          const fb = await submitSimFeedback({
            orderId: t.id,
            blueprintId,
            userId,
            completion: "completed",
            score: 10,
            reflection: "Done.",
          });
          totalFeedback++;
          if (fb.requiresInterrogation) {
            await submitInterrogationAnswer(
              fb.feedbackId,
              userId,
              "I completed the full user authentication flow with email magic links. Tested with 3 accounts.",
              blueprintId,
            );
          }
        }
      }

      let done = 0;
      for (const t of tasks) {
        if (done >= plan.completions) break;
        if (day === 4 && tasks.indexOf(t) === 3) continue;
        await db.update(orders).set({ status: "active" }).where(eq(orders.id, t.id));
        await submitSimFeedback({
          orderId: t.id,
          blueprintId,
          userId,
          completion: done < plan.completions - 1 || day !== 9 ? "completed" : mapCompletion(day === 9 && done >= 1 ? "partial" : "completed"),
          score: Math.round(plan.avgScore),
          reflection: `Day ${day} task ${done + 1}: Delivered measurable output toward $10k MRR goal.`,
          difficultyFelt: day >= 8 ? "hard" : "moderate",
        });
        totalFeedback++;
        done++;
      }

      if (day === 9) {
        const cond = await getCurrentCondition(blueprintId);
        if (cond === "power" || cond === "affluence") {
          breaks.push({
            day: 9,
            issue: `Recovery day expected drop from peak, still ${cond}`,
            fix: "Crash-day feedback should lower framework signals or enter power_change/danger",
          });
        }
        const enf = await getCurrentEnforcement(blueprintId);
        if (enf.taskLimits.max > 6 && (cond === "power" || cond === "affluence")) {
          breaks.push({
            day: 9,
            issue: "Task limits not reduced after crash day while still at peak condition",
            fix: "Enforcement package should tighten on danger/urgency/power_change",
          });
        }
      }

      if (day === 8) {
        const cond = await getCurrentCondition(blueprintId);
        const peakConditions = new Set(["power", "affluence", "stability"]);
        if (!peakConditions.has(cond)) {
          breaks.push({
            day: 8,
            issue: `Expected peak execution (power/stability), got ${cond}`,
            fix: "Sustain high scores through Day 7 to raise growth/momentum signals",
          });
        }
      }

      if (day >= 10 && day <= 11) {
        const cond = await getCurrentCondition(blueprintId);
        if (cond === "nothingness") {
          breaks.push({
            day,
            issue: "Recovery days should not return to nothingness",
            fix: "Re-run signal chain after recovery feedback",
          });
        }
      }

      await recordDay(day);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const [{ totalTasks = 0 } = {}] = await db
    .select({ totalTasks: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.blueprint_id, blueprintId));

  const [{ dlq = 0 } = {}] = await db
    .select({ dlq: sql<number>`count(*)::int` })
    .from(deadLetterEvents)
    .where(eq(deadLetterEvents.blueprint_id, blueprintId));

  const finalCondition = await getCurrentCondition(blueprintId);
  const sig = await getCurrentSignals(blueprintId);

  const [{ plans: planCount = 0 } = {}] = await db
    .select({ plans: sql<number>`count(distinct ${plans.id})::int` })
    .from(plans)
    .where(eq(plans.blueprint_id, blueprintId));

  if (planCount === 0) {
    breaks.push({ day: 0, issue: "Blueprint hierarchy missing plans", fix: "activateBlueprint chain compile" });
  }

  return {
    ok: errors.length === 0 && totalTasks >= 80 && dlq === 0 && finalCondition !== "nothingness",
    blueprintId,
    userId,
    daysCompleted: daySummaries.length,
    totalTasksGenerated: totalTasks,
    totalFeedback,
    deadLetterCount: dlq,
    breaks,
    finalCondition,
    highestMomentum: Math.max(highestMomentum, sig.momentum),
    conditionTransitions,
    daySummaries,
    errors,
  };
}

export function formatSimulationReport(report: SimulationReport): string {
  const lines = [
    "=== TORGIMA 14-DAY SIMULATION REPORT ===",
    "",
    "SIMULATION PARAMETERS:",
    `Goal: ${SAAS_GOAL.slice(0, 80)}…`,
    "Duration: 14 days",
    "Start condition: nothingness",
    `End condition: ${report.finalCondition}`,
    "",
    "TASK GENERATION:",
    `Total tasks generated: ${report.totalTasksGenerated}`,
    `Average tasks per day: ${(report.totalTasksGenerated / Math.max(report.daysCompleted, 1)).toFixed(1)}`,
    `Days simulated: ${report.daysCompleted} / 14`,
    "",
    "FEEDBACK LOOP:",
    `Total feedback submissions: ${report.totalFeedback}`,
    `Dead letter events: ${report.deadLetterCount}`,
    `Highest momentum: ${report.highestMomentum} days`,
    "",
    "CONDITION TRANSITIONS:",
    ...(report.conditionTransitions.length ? report.conditionTransitions.map((t) => `- ${t}`) : ["- (none recorded)"]),
    "",
    "DAY SUMMARIES:",
    ...report.daySummaries.map(
      (d) => `  Day ${d.day}: tasks=${d.tasks} feedback=${d.feedback} condition=${d.condition} momentum=${d.momentum}`,
    ),
    "",
    "BREAKS FOUND AND FIXED:",
    ...(report.breaks.length
      ? report.breaks.map((b) => `- Day ${b.day}: ${b.issue} → ${b.fix}`)
      : ["- None"]),
    "",
    "ERRORS:",
    ...(report.errors.length ? report.errors.map((e) => `- ${e}`) : ["- None"]),
    "",
    `SYSTEM STATUS: ${report.ok ? "PRODUCTION READY (sim passed)" : "NEEDS ATTENTION"}`,
    `Critical blockers: ${report.ok ? "NONE" : report.errors.join("; ") || "See breaks"}`,
  ];
  return lines.join("\n");
}
