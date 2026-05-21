/**
 * PROMPT 2 Stage 5 — Torgima execution integration (goals, calendar, XP, principles profile).
 */
import {
  db,
  academyCourses,
  academyLearningGoals,
  academyStudySessions,
  academyStudentEnrollments,
  academyConceptMastery,
  orders,
  phases,
  blueprints,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { evaluateReward } from "../reward/RewardEngine.js";
import { logLearningEvidenceOnProfile } from "../principles/Principles365Engine.js";
import { ensureAcademyCatalogSeeded } from "./ErectorAcademyEngine.js";

const DOMAIN_SKILL_MAP: Record<string, string[]> = {
  business: ["business", "marketing", "leadership"],
  content: ["marketing", "design"],
  technology: ["coding", "design"],
  health: ["fitness", "leadership"],
};

export async function recommendCoursesForBlueprint(blueprintId: string) {
  await ensureAcademyCatalogSeeded();
  const [bp] = await db
    .select({ domain: blueprints.domain, goal: blueprints.goal })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const domainKey = (bp?.domain ?? "business").toLowerCase();
  const categories = DOMAIN_SKILL_MAP[domainKey] ?? ["business", "leadership"];
  const all = await db.select().from(academyCourses);

  const matched = all.filter((c) => categories.includes(c.category));
  return (matched.length ? matched : all).slice(0, 5).map((c) => ({
    courseId: c.id,
    title: c.title,
    category: c.category,
    difficultyLevel: c.difficulty_level,
    reason: `Recommended for blueprint domain "${domainKey}"`,
  }));
}

export async function getGoalsForTorgimaBlueprint(blueprintId: string, userId: string) {
  const goals = await db
    .select()
    .from(academyLearningGoals)
    .where(
      and(
        eq(academyLearningGoals.user_id, userId),
        eq(academyLearningGoals.aligned_with_blueprint_id, blueprintId),
      ),
    )
    .orderBy(desc(academyLearningGoals.created_at));

  const courseRecs = await recommendCoursesForBlueprint(blueprintId);
  return { goals, recommendedCourses: courseRecs };
}

export async function suggestLearningForOrder(params: {
  userId: string;
  orderId: string;
}) {
  const [order] = await db
    .select({
      title: orders.title,
      instruction: orders.instruction,
      blueprint_id: orders.blueprint_id,
    })
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  if (!order) return { suggestions: [] };

  await ensureAcademyCatalogSeeded();
  const text = `${order.title ?? ""} ${order.instruction ?? ""}`.toLowerCase();
  const courses = await db.select().from(academyCourses);
  const matched = courses.filter(
    (c) =>
      text.includes(c.category) ||
      c.title.toLowerCase().split(" ").some((w) => text.includes(w)),
  );

  const suggestions = (matched.length ? matched : courses.slice(0, 2)).map((c) => ({
    courseId: c.id,
    title: c.title,
    goalTitle: `Build skill: ${c.title}`,
    targetSkill: c.category,
    alignedWithBlueprintId: order.blueprint_id,
  }));

  return { suggestions, orderTitle: order.title };
}

export async function scheduleStudySession(params: {
  userId: string;
  learningGoalId?: string;
  scheduleId?: string;
  sessionDate: string;
  startTime: string;
  durationMinutes?: number;
}) {
  const [session] = await db
    .insert(academyStudySessions)
    .values({
      user_id: params.userId,
      learning_goal_id: params.learningGoalId,
      schedule_id: params.scheduleId,
      session_date: params.sessionDate,
      start_time: params.startTime,
      duration_minutes: params.durationMinutes ?? 45,
    })
    .returning();

  return session;
}

export async function syncStudySessionToCalendar(studySessionId: string, userId: string) {
  const { syncStudySessionToCalendarEvent } = await import(
    "../calendar/CalendarSyncService.js"
  );
  return syncStudySessionToCalendarEvent(studySessionId, userId);
}

export function calculateLearningXp(masteryLevel: number): number {
  if (masteryLevel >= 90) return 50;
  if (masteryLevel >= 70) return 30;
  if (masteryLevel >= 40) return 15;
  return 5;
}

export async function awardXpForLearning(params: {
  userId: string;
  conceptId: string;
  masteryLevel: number;
  blueprintId?: string;
}) {
  const xp = calculateLearningXp(params.masteryLevel);
  const result = await evaluateReward({
    userId: params.userId,
    blueprintId: params.blueprintId,
    sourceType: "CAPABILITY",
    sourceId: params.conceptId,
    idempotencyKey: `academy:${params.userId}:${params.conceptId}:${Math.floor(params.masteryLevel)}`,
    stateVersion: 0,
  });

  return { xp, rewardCreated: result.rewardCreated, rewardId: result.rewardId, rewardType: result.rewardType };
}

export async function logCourseCompletionOnProfile(params: {
  userId: string;
  courseId: string;
  completionDate?: string;
}) {
  const [course] = await db
    .select({ title: academyCourses.title })
    .from(academyCourses)
    .where(eq(academyCourses.id, params.courseId))
    .limit(1);

  const message = course
    ? `Completed Academy course: ${course.title}`
    : `Completed Academy course ${params.courseId}`;

  await logLearningEvidenceOnProfile({
    userId: params.userId,
    message,
    courseId: params.courseId,
    principleDate: params.completionDate,
  });

  return { logged: true, message };
}

export async function getLearningEvidence(userId: string, date: string) {
  const enrollments = await db
    .select({
      enrollment: academyStudentEnrollments,
      course: academyCourses,
    })
    .from(academyStudentEnrollments)
    .innerJoin(academyCourses, eq(academyStudentEnrollments.course_id, academyCourses.id))
    .where(eq(academyStudentEnrollments.user_id, userId));

  const mastery = await db
    .select()
    .from(academyConceptMastery)
    .where(eq(academyConceptMastery.user_id, userId))
    .orderBy(desc(academyConceptMastery.last_attempted_at))
    .limit(5);

  return {
    date,
    enrollments: enrollments.map((e) => ({
      courseTitle: e.course.title,
      progressPercent: e.enrollment.progress_percent,
      status: e.enrollment.status,
    })),
    recentMastery: mastery,
  };
}

export async function getAlignmentWithTorgima(blueprintId: string) {
  const [bp] = await db
    .select({ goal: blueprints.goal, domain: blueprints.domain })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const phaseRows = await db
    .select({ name: phases.name, title: phases.title })
    .from(phases)
    .where(eq(phases.blueprint_id, blueprintId))
    .orderBy(asc(phases.order_index))
    .limit(3);

  const courses = await recommendCoursesForBlueprint(blueprintId);

  return {
    blueprint: bp,
    activePhases: phaseRows.map((p) => p.title ?? p.name),
    recommendedCourses: courses,
    insight:
      "Prep skills in Academy before high-stakes execution orders in the matching blueprint phase.",
  };
}
