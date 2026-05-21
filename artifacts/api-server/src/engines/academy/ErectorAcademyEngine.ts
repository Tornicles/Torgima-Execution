/**
 * PROMPT 2 — Erector Academy: router, tutor, practice, evaluation, memory, planning.
 */
import {
  db,
  academyCourses,
  academyChapters,
  academyLessons,
  academyPracticeItems,
  academyStudentEnrollments,
  academyStudentLearningProfiles,
  academyLessonAttempts,
  academyPracticeAttempts,
  academyConceptMastery,
  academyLearningPatterns,
  academyRetentionData,
  academyLearningGoals,
  academyStudySchedules,
  academyRoadmapSteps,
  academyGeneratedContent,
} from "@workspace/db";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { SAMPLE_ACADEMY_COURSES } from "./academySampleCatalog.js";

export type AcademyAction =
  | "teach_me"
  | "quiz_me"
  | "explain_this"
  | "practice"
  | "show_progress"
  | "grade";

export type LearningProfile = {
  learningStyle: string;
  pace: string;
  preferredFormats: string[];
  comprehensionSpeed: number;
  retentionRate: number;
  commonMistakes: string[];
  strengths: string[];
  weaknesses: string[];
};

export function calculateRetentionCurve(daysSinceLastReview: number, difficulty: number): number {
  const strength = 1 + (5 - difficulty) / 10;
  const retention = Math.exp(-daysSinceLastReview / strength);
  return Math.max(0, retention * 100);
}

export function calculateNextReviewDate(mastery: number, lastReviewDate: Date): string {
  const ms =
    mastery < 40
      ? 1 * 86400000
      : mastery < 70
        ? 3 * 86400000
        : mastery < 90
          ? 7 * 86400000
          : 30 * 86400000;
  return new Date(lastReviewDate.getTime() + ms).toISOString().slice(0, 10);
}

export function routeAcademyRequest(input: {
  action: AcademyAction;
  topic?: string;
  learningProfile?: LearningProfile;
}): { engine: string; payload: Record<string, unknown>; reasoning: string } {
  const style = input.learningProfile?.learningStyle ?? "reading";
  const pace = input.learningProfile?.pace ?? "normal";

  if (input.action === "teach_me" || input.action === "explain_this") {
    return {
      engine: "tutor",
      payload: { topic: input.topic, learningStyle: style, pace },
      reasoning: "User requested teaching or explanation",
    };
  }
  if (input.action === "quiz_me" || input.action === "practice") {
    return {
      engine: "practice",
      payload: { topic: input.topic, difficulty: 2 },
      reasoning: "User requested practice or quiz",
    };
  }
  if (input.action === "show_progress") {
    return { engine: "planning", payload: {}, reasoning: "User requested progress view" };
  }
  if (input.action === "grade") {
    return { engine: "evaluation", payload: {}, reasoning: "User submitted work for grading" };
  }
  return { engine: "content", payload: { topic: input.topic }, reasoning: "Default content engine" };
}

export async function ensureAcademyCatalogSeeded(): Promise<number> {
  const [{ c = 0 } = {}] = await db.select({ c: count() }).from(academyCourses);
  if (Number(c) >= SAMPLE_ACADEMY_COURSES.length) return Number(c);

  for (const course of SAMPLE_ACADEMY_COURSES) {
    const [cRow] = await db
      .insert(academyCourses)
      .values({
        title: course.title,
        description: course.description,
        category: course.category,
        difficulty_level: course.difficultyLevel,
        estimated_duration_hours: course.estimatedDurationHours,
      })
      .returning();

    let chapterNum = 0;
    for (const ch of course.chapters) {
      chapterNum += 1;
      const [chRow] = await db
        .insert(academyChapters)
        .values({
          course_id: cRow!.id,
          chapter_number: chapterNum,
          title: ch.title,
          description: ch.description,
          learning_objectives: ch.objectives,
        })
        .returning();

      let lessonNum = 0;
      for (const les of ch.lessons) {
        lessonNum += 1;
        const [lesRow] = await db
          .insert(academyLessons)
          .values({
            chapter_id: chRow!.id,
            lesson_number: lessonNum,
            title: les.title,
            content_type: les.contentType,
            content_body: les.contentBody,
            key_concepts: les.keyConcepts,
            reading_time_minutes: les.readingTimeMinutes,
          })
          .returning();

        await db.insert(academyPracticeItems).values({
          lesson_id: lesRow!.id,
          item_type: "quiz",
          difficulty: les.practice.difficulty,
          question_text: les.practice.question,
          answer_options: les.practice.options ?? null,
          correct_answer: les.practice.correctAnswer,
          explanation: les.practice.explanation,
        });
      }
    }
  }

  const [{ c: after = 0 } = {}] = await db.select({ c: count() }).from(academyCourses);
  return Number(after);
}

export async function getOrCreateLearningProfile(userId: string): Promise<LearningProfile> {
  const [row] = await db
    .select()
    .from(academyStudentLearningProfiles)
    .where(eq(academyStudentLearningProfiles.user_id, userId))
    .limit(1);

  if (row) {
    return {
      learningStyle: row.learning_style,
      pace: row.pace,
      preferredFormats: (row.preferred_formats as string[]) ?? ["text"],
      comprehensionSpeed: row.comprehension_speed ?? 1,
      retentionRate: row.retention_rate ?? 0.7,
      commonMistakes: (row.common_mistakes as string[]) ?? [],
      strengths: (row.strengths as string[]) ?? [],
      weaknesses: (row.weaknesses as string[]) ?? [],
    };
  }

  const [created] = await db
    .insert(academyStudentLearningProfiles)
    .values({ user_id: userId })
    .returning();

  return {
    learningStyle: created!.learning_style,
    pace: created!.pace,
    preferredFormats: (created!.preferred_formats as string[]) ?? ["text"],
    comprehensionSpeed: created!.comprehension_speed ?? 1,
    retentionRate: created!.retention_rate ?? 0.7,
    commonMistakes: [],
    strengths: [],
    weaknesses: [],
  };
}

export async function getFirstLessonForCourse(courseId: string) {
  const [chapter] = await db
    .select()
    .from(academyChapters)
    .where(eq(academyChapters.course_id, courseId))
    .orderBy(asc(academyChapters.chapter_number))
    .limit(1);
  if (!chapter) return null;
  const [lesson] = await db
    .select()
    .from(academyLessons)
    .where(eq(academyLessons.chapter_id, chapter.id))
    .orderBy(asc(academyLessons.lesson_number))
    .limit(1);
  return lesson ?? null;
}

export async function getLessonContent(lessonId: string) {
  const [lesson] = await db
    .select()
    .from(academyLessons)
    .where(eq(academyLessons.id, lessonId))
    .limit(1);
  if (!lesson) return null;

  const items = await db
    .select()
    .from(academyPracticeItems)
    .where(eq(academyPracticeItems.lesson_id, lessonId));

  return { lesson, practiceItems: items };
}

export async function buildTutorExplanation(params: {
  userId: string;
  lessonId: string;
  profile: LearningProfile;
}) {
  const content = await getLessonContent(params.lessonId);
  if (!content) throw new Error("Lesson not found");

  const lesson = content.lesson;
  const keyPoints = (lesson.key_concepts as string[]) ?? [];
  let explanation = lesson.content_body;

  const bhudhi = await routeBhudhiRequest({
    sourceEngine: "ErectorAcademyEngine",
    triggerType: "EXECUTION_SUPPORT",
    requestedMode: "INTERPRET",
    userId: params.userId,
    stateVersion: 0,
    idempotencyKey: `academy_tutor:${params.userId}:${params.lessonId}`,
    facts: {
      lessonTitle: lesson.title,
      learningStyle: params.profile.learningStyle,
      pace: params.profile.pace,
      keyConcepts: keyPoints,
    },
  }).catch(() => null);

  const data = bhudhi?.output?.data as { explanation?: string } | undefined;
  if (data?.explanation && data.explanation.length > 40) {
    explanation = data.explanation.slice(0, 4000);
  }

  const visualAids =
    params.profile.learningStyle === "visual"
      ? keyPoints.map((k) => `diagram:${k}`)
      : [];

  return {
    explanation,
    examples: keyPoints.map((k) => `Example: apply ${k} to one active order today.`),
    analogies: [`Think of ${keyPoints[0] ?? "this concept"} as a constraint that protects focus.`],
    visualAids,
    keyPoints,
    nextSteps: "Complete the practice item and submit proof of application.",
    estimatedTime: lesson.reading_time_minutes,
  };
}

export async function getPracticeForLesson(params: {
  userId: string;
  lessonId: string;
  difficulty?: number;
}) {
  const items = await db
    .select()
    .from(academyPracticeItems)
    .where(eq(academyPracticeItems.lesson_id, params.lessonId))
    .orderBy(asc(academyPracticeItems.difficulty));

  if (!items.length) return null;

  const targetDiff = params.difficulty ?? 2;
  const item =
    items.find((i) => i.difficulty === targetDiff) ??
    items[Math.min(items.length - 1, Math.floor(items.length / 2))]!;

  return {
    practiceItem: item,
    hints: ["Re-read key concepts", "Apply to one real execution artifact"],
    passScore: 70,
  };
}

export function evaluatePracticeAnswer(params: {
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}): {
  correct: boolean;
  score: number;
  feedback: string;
  correction: string;
  explanation: string;
  nextStep: string;
} {
  const normalized = (s: string) => s.trim().toLowerCase();
  const correct = normalized(params.userAnswer) === normalized(params.correctAnswer);
  const score = correct ? 100 : 0;
  return {
    correct,
    score,
    feedback: correct ? "Correct — proof recorded." : "Not quite — review the concept below.",
    correction: correct ? "" : `Expected: ${params.correctAnswer}`,
    explanation: params.explanation,
    nextStep: correct ? "Take the next lesson or increase difficulty." : "Retry with hints, then review lesson.",
  };
}

export async function submitPracticeAttempt(params: {
  userId: string;
  practiceItemId: string;
  userAnswer: string;
  timeTakenSeconds?: number;
  isRetry?: boolean;
}) {
  const [item] = await db
    .select()
    .from(academyPracticeItems)
    .where(eq(academyPracticeItems.id, params.practiceItemId))
    .limit(1);
  if (!item) throw new Error("Practice item not found");

  const evaluation = evaluatePracticeAnswer({
    userAnswer: params.userAnswer,
    correctAnswer: item.correct_answer,
    explanation: item.explanation,
  });

  const [attempt] = await db
    .insert(academyPracticeAttempts)
    .values({
      user_id: params.userId,
      practice_item_id: params.practiceItemId,
      user_answer: params.userAnswer,
      correct: evaluation.correct,
      time_taken_seconds: params.timeTakenSeconds,
      is_retry: params.isRetry ?? false,
    })
    .returning();

  const memory = await updateLearningMemory({
    userId: params.userId,
    lessonId: item.lesson_id,
    practiceItemId: params.practiceItemId,
    score: evaluation.score,
    correct: evaluation.correct,
    conceptIds: [],
  });

  if (evaluation.correct) {
    const { awardXpForLearning } = await import("./AcademyIntegrationEngine.js");
    const [mastery] = await db
      .select()
      .from(academyConceptMastery)
      .where(
        and(
          eq(academyConceptMastery.user_id, params.userId),
          eq(academyConceptMastery.concept_id, `lesson:${item.lesson_id}`),
        ),
      )
      .limit(1);
    await awardXpForLearning({
      userId: params.userId,
      conceptId: `lesson:${item.lesson_id}`,
      masteryLevel: mastery?.mastery_level ?? evaluation.score,
    });
  }

  return { attempt, evaluation, memory };
}

export async function updateLearningMemory(params: {
  userId: string;
  lessonId: string;
  practiceItemId: string;
  score: number;
  correct: boolean;
  conceptIds: string[];
}) {
  const profile = await getOrCreateLearningProfile(params.userId);

  for (const conceptId of params.conceptIds.length ? params.conceptIds : [`lesson:${params.lessonId}`]) {
    const [existing] = await db
      .select()
      .from(academyConceptMastery)
      .where(
        and(
          eq(academyConceptMastery.user_id, params.userId),
          eq(academyConceptMastery.concept_id, conceptId),
        ),
      )
      .limit(1);

    const total = (existing?.total_attempts ?? 0) + 1;
    const success = (existing?.successful_attempts ?? 0) + (params.correct ? 1 : 0);
    const mastery = (success / total) * 100;

    if (existing) {
      await db
        .update(academyConceptMastery)
        .set({
          mastery_level: mastery,
          total_attempts: total,
          successful_attempts: success,
          last_attempted_at: new Date(),
          confidence: params.correct ? Math.min(1, (existing.confidence ?? 0.5) + 0.1) : Math.max(0.1, (existing.confidence ?? 0.5) - 0.15),
          updated_at: new Date(),
        })
        .where(eq(academyConceptMastery.id, existing.id));
    } else {
      await db.insert(academyConceptMastery).values({
        user_id: params.userId,
        concept_id: conceptId,
        mastery_level: mastery,
        total_attempts: total,
        successful_attempts: success,
        confidence: params.correct ? 0.6 : 0.35,
      });
    }
  }

  if (!params.correct) {
    const mistake = `Missed practice ${params.practiceItemId}`;
    const mistakes = [...profile.commonMistakes, mistake].slice(-20);
    await db
      .update(academyStudentLearningProfiles)
      .set({ common_mistakes: mistakes, updated_at: new Date() })
      .where(eq(academyStudentLearningProfiles.user_id, params.userId));

    await db.insert(academyLearningPatterns).values({
      user_id: params.userId,
      pattern_type: "common-mistake",
      pattern_description: mistake,
      actionable_insight: "Review lesson and retry with hints",
    });
  }

  const [ret] = await db
    .select()
    .from(academyRetentionData)
    .where(
      and(
        eq(academyRetentionData.user_id, params.userId),
        eq(academyRetentionData.lesson_id, params.lessonId),
      ),
    )
    .limit(1);

  const correctCount = (ret?.recalled_correctly ?? 0) + (params.correct ? 1 : 0);
  const incorrectCount = (ret?.recalled_incorrectly ?? 0) + (params.correct ? 0 : 1);
  const totalRecall = correctCount + incorrectCount;
  const retentionPercent = totalRecall ? (correctCount / totalRecall) * 100 : 0;
  const daysSince = ret
    ? Math.floor((Date.now() - new Date(ret.learned_at).getTime()) / 86400000)
    : 0;
  const forgettingCurve = calculateRetentionCurve(daysSince, 2);
  const nextReview = calculateNextReviewDate(retentionPercent, new Date());

  if (ret) {
    await db
      .update(academyRetentionData)
      .set({
        recalled_correctly: correctCount,
        recalled_incorrectly: incorrectCount,
        retention_percent: retentionPercent,
        forgetting_curve: forgettingCurve,
        next_review_date: nextReview,
        updated_at: new Date(),
      })
      .where(eq(academyRetentionData.id, ret.id));
  } else {
    await db.insert(academyRetentionData).values({
      user_id: params.userId,
      lesson_id: params.lessonId,
      recalled_correctly: correctCount,
      recalled_incorrectly: incorrectCount,
      retention_percent: retentionPercent,
      forgetting_curve: forgettingCurve,
      next_review_date: nextReview,
    });
  }

  return { updatedProfile: await getOrCreateLearningProfile(params.userId) };
}

export async function enrollUserInCourse(userId: string, courseId: string) {
  const [existing] = await db
    .select()
    .from(academyStudentEnrollments)
    .where(
      and(
        eq(academyStudentEnrollments.user_id, userId),
        eq(academyStudentEnrollments.course_id, courseId),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [row] = await db
    .insert(academyStudentEnrollments)
    .values({
      user_id: userId,
      course_id: courseId,
      status: "in-progress",
      started_at: new Date(),
    })
    .returning();
  return row;
}

export async function getAcademyDashboard(userId: string) {
  await ensureAcademyCatalogSeeded();
  const profile = await getOrCreateLearningProfile(userId);

  const enrollments = await db
    .select({
      enrollment: academyStudentEnrollments,
      course: academyCourses,
    })
    .from(academyStudentEnrollments)
    .innerJoin(academyCourses, eq(academyStudentEnrollments.course_id, academyCourses.id))
    .where(eq(academyStudentEnrollments.user_id, userId))
    .orderBy(desc(academyStudentEnrollments.enrolled_at));

  const mastery = await db
    .select()
    .from(academyConceptMastery)
    .where(eq(academyConceptMastery.user_id, userId))
    .orderBy(desc(academyConceptMastery.mastery_level))
    .limit(10);

  const courses = await db.select().from(academyCourses).orderBy(asc(academyCourses.title));

  const recommendations = courses
    .filter((c) => !enrollments.some((e) => e.course.id === c.id))
    .slice(0, 3)
    .map((c) => ({ courseId: c.id, title: c.title, category: c.category }));

  return {
    profile,
    enrollments: enrollments.map((e) => ({
      ...e.enrollment,
      courseTitle: e.course.title,
      category: e.course.category,
    })),
    mastery,
    recommendations,
  };
}

export async function createLearningGoal(params: {
  userId: string;
  goalTitle: string;
  targetSkill: string;
  targetMasteryLevel?: number;
  deadline?: string;
  alignedWithBlueprintId?: string;
}) {
  const [goal] = await db
    .insert(academyLearningGoals)
    .values({
      user_id: params.userId,
      goal_title: params.goalTitle,
      target_skill: params.targetSkill,
      target_mastery_level: params.targetMasteryLevel ?? 80,
      deadline: params.deadline,
      aligned_with_blueprint_id: params.alignedWithBlueprintId,
    })
    .returning();

  await ensureAcademyCatalogSeeded();
  const allCourses = await db.select().from(academyCourses).limit(5);
  const skillToken = params.targetSkill.toLowerCase();
  const matched = allCourses.filter(
    (c) =>
      c.category.toLowerCase().includes(skillToken) ||
      c.title.toLowerCase().includes(skillToken),
  );
  const courses = matched.length ? matched : allCourses;

  let step = 0;
  for (const course of (courses.length ? courses : allCourses).slice(0, 3)) {
    step += 1;
    await db.insert(academyRoadmapSteps).values({
      user_id: params.userId,
      learning_goal_id: goal!.id,
      step_number: step,
      course_id: course.id,
      estimated_duration_days: 7,
      status: step === 1 ? "in-progress" : "not-started",
    });
  }

  return goal;
}

export async function generateStudyPlan(params: {
  userId: string;
  learningGoalId: string;
  sessionsPerWeek?: number;
  minutesPerSession?: number;
}) {
  const [schedule] = await db
    .insert(academyStudySchedules)
    .values({
      user_id: params.userId,
      learning_goal_id: params.learningGoalId,
      sessions_per_week: params.sessionsPerWeek ?? 3,
      minutes_per_session: params.minutesPerSession ?? 45,
      start_date: new Date().toISOString().slice(0, 10),
    })
    .returning();

  const steps = await db
    .select()
    .from(academyRoadmapSteps)
    .where(eq(academyRoadmapSteps.learning_goal_id, params.learningGoalId))
    .orderBy(asc(academyRoadmapSteps.step_number));

  return { schedule, roadmap: steps };
}

export async function getWeakAreas(userId: string) {
  const profile = await getOrCreateLearningProfile(userId);
  const lowMastery = await db
    .select()
    .from(academyConceptMastery)
    .where(eq(academyConceptMastery.user_id, userId))
    .orderBy(asc(academyConceptMastery.mastery_level))
    .limit(10);

  const dueReview = await db
    .select()
    .from(academyRetentionData)
    .where(eq(academyRetentionData.user_id, userId))
    .limit(20);

  return {
    weaknesses: profile.weaknesses,
    commonMistakes: profile.commonMistakes,
    lowMastery,
    dueReview: dueReview.filter(
      (r) => r.next_review_date && r.next_review_date <= new Date().toISOString().slice(0, 10),
    ),
  };
}

export async function getAcademyRecommendations(userId: string) {
  const dashboard = await getAcademyDashboard(userId);
  const dueReview = await db
    .select()
    .from(academyRetentionData)
    .where(eq(academyRetentionData.user_id, userId));

  const today = new Date().toISOString().slice(0, 10);
  const reviewDue = dueReview.filter(
    (r) => r.next_review_date && r.next_review_date <= today,
  );

  return {
    recommendedCourses: dashboard.recommendations,
    nextAction:
      reviewDue.length > 0
        ? "Review weak concepts from prior lessons"
        : dashboard.enrollments.length > 0
          ? "Continue in-progress enrollment"
          : "Enroll in a recommended course",
    reviewDue,
  };
}

export async function scheduleConceptReview(userId: string, conceptId: string) {
  const [row] = await db
    .select()
    .from(academyConceptMastery)
    .where(
      and(eq(academyConceptMastery.user_id, userId), eq(academyConceptMastery.concept_id, conceptId)),
    )
    .limit(1);

  const nextReview = calculateNextReviewDate(row?.mastery_level ?? 30, new Date());
  if (row) {
    const lessonId = conceptId.startsWith("lesson:") ? conceptId.slice(7) : null;
    if (lessonId) {
      await db
        .update(academyRetentionData)
        .set({ next_review_date: nextReview, updated_at: new Date() })
        .where(
          and(
            eq(academyRetentionData.user_id, userId),
            eq(academyRetentionData.lesson_id, lessonId),
          ),
        );
    }
  }

  return { conceptId, nextReviewDate: nextReview };
}

export async function getDailyStudyPlan(userId: string) {
  const [schedule] = await db
    .select()
    .from(academyStudySchedules)
    .where(eq(academyStudySchedules.user_id, userId))
    .orderBy(desc(academyStudySchedules.created_at))
    .limit(1);

  const enrollments = await db
    .select({ course: academyCourses, enrollment: academyStudentEnrollments })
    .from(academyStudentEnrollments)
    .innerJoin(academyCourses, eq(academyStudentEnrollments.course_id, academyCourses.id))
    .where(
      and(
        eq(academyStudentEnrollments.user_id, userId),
        eq(academyStudentEnrollments.status, "in-progress"),
      ),
    )
    .limit(1);

  const lessonMinutes = schedule?.minutes_per_session ?? 45;
  return {
    schedule,
    activeCourse: enrollments[0]?.course.title ?? null,
    dailyStudyPlan: {
      lessons: [{ title: enrollments[0]?.course.title ?? "Pick a course", readingTime: lessonMinutes }],
      practiceTime: Math.round(lessonMinutes * 0.4),
      reviewTime: Math.round(lessonMinutes * 0.2),
    },
  };
}

export async function getLearningRoadmap(learningGoalId: string, userId: string) {
  const steps = await db
    .select({
      step: academyRoadmapSteps,
      course: academyCourses,
    })
    .from(academyRoadmapSteps)
    .leftJoin(academyCourses, eq(academyRoadmapSteps.course_id, academyCourses.id))
    .where(
      and(
        eq(academyRoadmapSteps.learning_goal_id, learningGoalId),
        eq(academyRoadmapSteps.user_id, userId),
      ),
    )
    .orderBy(asc(academyRoadmapSteps.step_number));

  return steps.map((s) => ({
    ...s.step,
    courseTitle: s.course?.title,
  }));
}

export async function getAcademyAnalytics(userId: string) {
  const [attemptCount] = await db
    .select({ c: count() })
    .from(academyPracticeAttempts)
    .where(eq(academyPracticeAttempts.user_id, userId));

  const [lessonCount] = await db
    .select({ c: count() })
    .from(academyLessonAttempts)
    .where(
      and(eq(academyLessonAttempts.user_id, userId), eq(academyLessonAttempts.passed, true)),
    );

  const mastery = await db
    .select()
    .from(academyConceptMastery)
    .where(eq(academyConceptMastery.user_id, userId));

  const avgMastery =
    mastery.length > 0
      ? mastery.reduce((s, m) => s + (m.mastery_level ?? 0), 0) / mastery.length
      : 0;

  return {
    totalPracticeAttempts: Number(attemptCount?.c ?? 0),
    lessonsCompleted: Number(lessonCount?.c ?? 0),
    conceptsTracked: mastery.length,
    averageMastery: Math.round(avgMastery),
    velocity: mastery.filter((m) => (m.mastery_level ?? 0) >= 70).length,
  };
}

export async function askTutorQuestion(params: {
  userId: string;
  question: string;
  lessonId?: string;
  topic?: string;
}) {
  const profile = await getOrCreateLearningProfile(params.userId);
  const bhudhi = await routeBhudhiRequest({
    sourceEngine: "ErectorAcademyEngine",
    triggerType: "EXECUTION_SUPPORT",
    requestedMode: "INTERPRET",
    userId: params.userId,
    stateVersion: 0,
    idempotencyKey: `academy_tutor_chat:${params.userId}:${Date.now()}`,
    facts: {
      question: params.question,
      topic: params.topic,
      lessonId: params.lessonId,
      learningStyle: profile.learningStyle,
    },
  }).catch(() => null);

  const data = bhudhi?.output?.data as { answer?: string; explanation?: string } | undefined;
  const answer =
    data?.answer ??
    data?.explanation ??
    `(${profile.learningStyle} mode) ${params.question} — apply today's concept to one real order and capture proof.`;

  return { answer, learningStyle: profile.learningStyle };
}

export async function completeLesson(params: {
  userId: string;
  lessonId: string;
  timeSpentSeconds?: number;
  score?: number;
}) {
  const passed = (params.score ?? 80) >= 70;
  const [attempt] = await db
    .insert(academyLessonAttempts)
    .values({
      user_id: params.userId,
      lesson_id: params.lessonId,
      completed_at: new Date(),
      time_spent_seconds: params.timeSpentSeconds,
      score: params.score ?? 80,
      passed,
    })
    .returning();

  const [lesson] = await db
    .select({ chapter_id: academyLessons.chapter_id })
    .from(academyLessons)
    .where(eq(academyLessons.id, params.lessonId))
    .limit(1);

  if (lesson) {
    const [chapter] = await db
      .select({ course_id: academyChapters.course_id })
      .from(academyChapters)
      .where(eq(academyChapters.id, lesson.chapter_id))
      .limit(1);

    if (chapter) {
      const [enrollment] = await db
        .select()
        .from(academyStudentEnrollments)
        .where(
          and(
            eq(academyStudentEnrollments.user_id, params.userId),
            eq(academyStudentEnrollments.course_id, chapter.course_id),
          ),
        )
        .limit(1);

      if (enrollment) {
        const nextProgress = Math.min(100, (enrollment.progress_percent ?? 0) + 15);
        const status = nextProgress >= 100 ? "completed" : "in-progress";
        await db
          .update(academyStudentEnrollments)
          .set({
            progress_percent: nextProgress,
            status,
            completed_at: status === "completed" ? new Date() : enrollment.completed_at,
            updated_at: new Date(),
          })
          .where(eq(academyStudentEnrollments.id, enrollment.id));

        if (status === "completed") {
          const { logCourseCompletionOnProfile, awardXpForLearning } = await import(
            "./AcademyIntegrationEngine.js"
          );
          await logCourseCompletionOnProfile({
            userId: params.userId,
            courseId: chapter.course_id,
          });
          await awardXpForLearning({
            userId: params.userId,
            conceptId: `course:${chapter.course_id}`,
            masteryLevel: 90,
          });

          const { tryAwardGamificationXp } = await import("../gamification/gamificationHooks.js");
          void tryAwardGamificationXp({
            userId: params.userId,
            eventType: "academy-course",
            sourceId: chapter.course_id,
            eventData: { courseDifficulty: 3 },
          });
        }
      }
    }
  }

  return attempt;
}

export async function generateLessonSummary(userId: string, lessonId: string) {
  const content = await getLessonContent(lessonId);
  if (!content) throw new Error("Lesson not found");

  const summary = `Summary: ${content.lesson.title}\n\n${content.lesson.content_body.slice(0, 500)}...`;
  const [row] = await db
    .insert(academyGeneratedContent)
    .values({
      user_id: userId,
      content_type: "summary",
      topic: content.lesson.title,
      generated_content: summary,
    })
    .returning();

  return row;
}
