/**
 * Prompt 10 — structured learning paths from knowledge library + academy.instruction.v1
 */
import {
  db,
  learningPaths,
  academyTasks,
  orders,
  blueprints,
  enforcementPackages,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import type { CapabilityGap } from "./CapabilityGapEngine.js";
import {
  lessonSequenceLengthForScore,
  sanitizeAcademyLanguage,
} from "./CapabilityGapEngine.js";
import { selectAcademyKnowledge } from "../../bhudhi/agents/KnowledgeAgent.js";
import { trigger } from "../../bhudhi/BhudhiCore.js";
import { logger } from "../../lib/logger.js";

export type PracticeType = "EXPLANATION" | "DEMONSTRATION" | "PRACTICE" | "ASSESSMENT";

export interface LearningPathLesson {
  lessonNumber: number;
  skillCategory: string;
  practiceType: PracticeType;
  lessonObjective: string;
  taskTitle: string;
  taskInstruction: string;
  masteryDefinition: string;
  proofRequirement: string;
  estimatedMinutes: number;
  completed?: boolean;
}

export const PRACTICE_SEQUENCES: Record<string, PracticeType[]> = {
  LOW: ["PRACTICE", "ASSESSMENT"],
  MEDIUM: ["EXPLANATION", "PRACTICE", "ASSESSMENT"],
  HIGH: ["EXPLANATION", "DEMONSTRATION", "PRACTICE", "PRACTICE"],
  BLOCKING: ["EXPLANATION", "DEMONSTRATION", "PRACTICE", "PRACTICE", "ASSESSMENT"],
};

function buildLessonContent(params: {
  gap: CapabilityGap;
  practiceType: PracticeType;
  lessonNumber: number;
  domain: string;
  knowledge: Awaited<ReturnType<typeof selectAcademyKnowledge>>;
}): Omit<LearningPathLesson, "completed"> {
  const skillLabel = params.gap.skillCategory.replace(/_/g, " ");
  const titles: Record<PracticeType, string> = {
    EXPLANATION: `Capability: ${skillLabel} — concept`,
    DEMONSTRATION: `Capability: ${skillLabel} — model execution`,
    PRACTICE: `Capability: ${skillLabel} — apply`,
    ASSESSMENT: `Capability: ${skillLabel} — mastery evidence`,
  };

  const instruction =
    params.practiceType === "EXPLANATION"
      ? `${params.knowledge.conceptExplanation}\n\n${params.knowledge.howToLearn}`
      : params.practiceType === "DEMONSTRATION"
        ? `Review this model:\n${params.knowledge.exampleOfMastery}\n\n${params.knowledge.practiceGuide}`
        : params.practiceType === "ASSESSMENT"
          ? `Demonstrate mastery:\n${params.knowledge.practiceGuide}\n\nSelf-check:\n${params.knowledge.selfAssessmentQuestions.join("\n")}`
          : params.knowledge.practiceGuide;

  return {
    lessonNumber: params.lessonNumber,
    skillCategory: params.gap.skillCategory,
    practiceType: params.practiceType,
    lessonObjective: `Apply ${skillLabel} at execution standard`,
    taskTitle: sanitizeAcademyLanguage(titles[params.practiceType]),
    taskInstruction: sanitizeAcademyLanguage(instruction.slice(0, 600)),
    masteryDefinition: sanitizeAcademyLanguage(
      params.knowledge.masteryIndicators[0] ?? "Documented proof of applied capability",
    ),
    proofRequirement: sanitizeAcademyLanguage(
      params.practiceType === "ASSESSMENT"
        ? "Submit mastery evidence matching the definition"
        : "Submit work sample or reflection showing application",
    ),
    estimatedMinutes: params.practiceType === "ASSESSMENT" ? 35 : 25,
  };
}

export async function generateLearningPath(params: {
  gap: CapabilityGap;
  userId: string;
  blueprintId: string;
}): Promise<{ learningPathId: string; orderId: string }> {
  const [bp] = await db
    .select({ goal: blueprints.goal, domain_hint: blueprints.domain_hint })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const domain =
    bp?.domain_hint?.includes("Growth") ? "Growth"
    : bp?.domain_hint?.includes("Operation") ? "Operations"
    : "Content";
  let sequence = [...(PRACTICE_SEQUENCES[params.gap.severity] ?? PRACTICE_SEQUENCES.MEDIUM)];
  const targetLen = lessonSequenceLengthForScore(params.gap.currentScore, params.gap.severity);
  while (sequence.length < targetLen) sequence.push("PRACTICE");
  if (sequence.length > targetLen) sequence = sequence.slice(0, targetLen);

  const lessons: LearningPathLesson[] = [];
  for (let i = 0; i < sequence.length; i++) {
    const practiceType = sequence[i]!;
    const knowledge = await selectAcademyKnowledge({
      skillCategory: params.gap.skillCategory,
      domain,
      practiceType,
      currentSkillLevel: params.gap.currentScore,
      lessonNumber: i + 1,
      userId: params.userId,
    });
    lessons.push(
      buildLessonContent({
        gap: params.gap,
        practiceType,
        lessonNumber: i + 1,
        domain,
        knowledge,
      }),
    );
  }

  const [path] = await db
    .insert(learningPaths)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      skill_gap: params.gap.skillCategory,
      domain,
      path_status: "ACTIVE",
      lessons,
      total_lessons: lessons.length,
      completed_lessons: 0,
    })
    .returning({ id: learningPaths.id });

  const first = lessons[0]!;
  const orderId = await createAcademyOrder({
    userId: params.userId,
    blueprintId: params.blueprintId,
    learningPathId: path!.id,
    lesson: first,
    goal: bp?.goal ?? "Execution goal",
  });

  logger.info(
    { userId: params.userId, pathId: path!.id, lessons: lessons.length },
    "[LearningPath] Generated",
  );

  return { learningPathId: path!.id, orderId };
}

async function createAcademyOrder(params: {
  userId: string;
  blueprintId: string;
  learningPathId: string;
  lesson: LearningPathLesson;
  goal: string;
}): Promise<string> {
  const [enf] = await db
    .select({ id: enforcementPackages.id })
    .from(enforcementPackages)
    .where(
      and(
        eq(enforcementPackages.blueprint_id, params.blueprintId),
        eq(enforcementPackages.is_current, true),
      ),
    )
    .limit(1);

  let instruction = params.lesson.taskInstruction;
  let title = params.lesson.taskTitle;

  try {
    const result = await trigger({
      sourceEngine: "academy_learning_path",
      triggerType: "ACADEMY_SUPPORT",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: 0,
      idempotencyKey: `academy:${params.learningPathId}:${params.lesson.lessonNumber}`,
      facts: {
        skillCategory: params.lesson.skillCategory,
        practiceType: params.lesson.practiceType,
        currentSkillLevel: 0.3,
        lessonObjective: params.lesson.lessonObjective,
        goal: params.goal,
        capabilityGap: params.lesson.skillCategory,
      },
    });
    if (result.ok && result.output?.data) {
      const d = result.output.data as Record<string, unknown>;
      title = sanitizeAcademyLanguage(String(d.title ?? d.taskTitle ?? title));
      instruction = sanitizeAcademyLanguage(String(d.instruction ?? instruction));
    }
  } catch {
    /* fallback content from lesson */
  }

  const [order] = await db
    .insert(orders)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      enforcement_package_id: enf?.id,
      title,
      instruction,
      expected_output: sanitizeAcademyLanguage(
        "Applied capability with documented evidence of execution quality.",
      ),
      definition_of_done: params.lesson.masteryDefinition,
      why_it_matters: sanitizeAcademyLanguage(
        `This execution skill closes a capability gap blocking progress toward: ${params.goal.slice(0, 120)}`,
      ),
      time_estimate_minutes: params.lesson.estimatedMinutes,
      difficulty: "easy",
      task_type: "academy",
      status: "pending",
      proof_required: params.lesson.practiceType === "ASSESSMENT",
      proof_description: params.lesson.proofRequirement,
    })
    .returning({ id: orders.id });

  await db.insert(academyTasks).values({
    blueprint_id: params.blueprintId,
    user_id: params.userId,
    order_id: order!.id,
    learning_path_id: params.learningPathId,
    title,
    description: instruction,
    learning_content: instruction,
    trigger_reason: "capability_gap",
    domain: "Content",
    skill_target: params.lesson.skillCategory,
    skill_category: params.lesson.skillCategory,
    lesson_number: params.lesson.lessonNumber,
    lesson_objective: params.lesson.lessonObjective,
    mastery_definition: params.lesson.masteryDefinition,
    practice_type: params.lesson.practiceType,
    proof_required: params.lesson.practiceType === "ASSESSMENT",
    proof_description: params.lesson.proofRequirement,
    status: "pending",
    blocks_execution: true,
  });

  return order!.id;
}

export async function getNextAcademyLesson(
  userId: string,
  learningPathId: string,
): Promise<LearningPathLesson | null> {
  const [path] = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, learningPathId), eq(learningPaths.user_id, userId)))
    .limit(1);

  if (!path || path.path_status !== "ACTIVE") return null;

  const lessons = (path.lessons as LearningPathLesson[]) ?? [];
  const next = lessons.find((l) => !l.completed);
  return next ?? null;
}

export async function advanceLearningPath(params: {
  userId: string;
  learningPathId: string;
  blueprintId: string;
  completedLessonNumber: number;
  completionScore: number;
}): Promise<{ orderId?: string; complete: boolean }> {
  const [path] = await db
    .select()
    .from(learningPaths)
    .where(eq(learningPaths.id, params.learningPathId))
    .limit(1);

  if (!path) return { complete: false };

  const lessons = ((path.lessons as LearningPathLesson[]) ?? []).map((l) =>
    l.lessonNumber === params.completedLessonNumber
      ? { ...l, completed: true, completionScore: params.completionScore }
      : l,
  );

  const completed = lessons.filter((l) => l.completed).length;

  await db
    .update(learningPaths)
    .set({ lessons, completed_lessons: completed })
    .where(eq(learningPaths.id, params.learningPathId));

  const next = lessons.find((l) => !l.completed);
  if (!next) return { complete: true };

  const [bp] = await db
    .select({ goal: blueprints.goal })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const orderId = await createAcademyOrder({
    userId: params.userId,
    blueprintId: params.blueprintId,
    learningPathId: params.learningPathId,
    lesson: next,
    goal: bp?.goal ?? "",
  });

  return { orderId, complete: false };
}

export async function extendLearningPathWithPractice(
  learningPathId: string,
  skillCategory: string,
): Promise<void> {
  const [path] = await db.select().from(learningPaths).where(eq(learningPaths.id, learningPathId)).limit(1);
  if (!path) return;

  const lessons = (path.lessons as LearningPathLesson[]) ?? [];
  const base = lessons.length;
  const extra: LearningPathLesson[] = [1, 2].map((i) => ({
    lessonNumber: base + i,
    skillCategory,
    practiceType: "PRACTICE" as const,
    lessonObjective: `Rebuild ${skillCategory.replace(/_/g, " ")} execution confidence`,
    taskTitle: `Capability: ${skillCategory.replace(/_/g, " ")} — guided apply`,
    taskInstruction: "Apply the capability with reduced scope. Document each step and outcome.",
    masteryDefinition: "Clear evidence of deliberate practice with measurable output",
    proofRequirement: "Work sample or reflection",
    estimatedMinutes: 20,
    completed: false,
  }));

  await db
    .update(learningPaths)
    .set({
      lessons: [...lessons, ...extra],
      total_lessons: lessons.length + extra.length,
    })
    .where(eq(learningPaths.id, learningPathId));
}

export async function getAcademyMorningSection(userId: string): Promise<Record<string, unknown> | null> {
  const [path] = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.user_id, userId), eq(learningPaths.path_status, "ACTIVE")))
    .orderBy(desc(learningPaths.created_at))
    .limit(1);

  if (!path) return null;

  const lessons = (path.lessons as LearningPathLesson[]) ?? [];
  const next = lessons.find((l) => !l.completed);
  const skillLabel = path.skill_gap.replace(/_/g, " ");

  return {
    activePath: `Capability Development: ${skillLabel}`,
    nextLesson: next
      ? `Execution step ${next.lessonNumber} of ${path.total_lessons}: ${next.practiceType} — ${next.taskTitle}`
      : "Mastery evidence pending",
    progress: `${path.completed_lessons} of ${path.total_lessons} complete`,
    masteryScore: path.mastery_score ?? null,
  };
}
