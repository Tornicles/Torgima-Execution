import { Router } from "express";
import { z } from "zod";
import {
  db,
  academyTasks,
  academyProof,
  skillProfiles,
  learningPaths,
  capabilityGapLogs,
  academyCourses,
  academyChapters,
} from "@workspace/db";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { getOrCreateSkillProfile } from "../engines/academy/CapabilityGapEngine.js";
import { getAcademyMorningSection } from "../engines/academy/LearningPathGenerator.js";
import {
  routeAcademyRequest,
  ensureAcademyCatalogSeeded,
  getOrCreateLearningProfile,
  getLessonContent,
  buildTutorExplanation,
  getPracticeForLesson,
  submitPracticeAttempt,
  getAcademyDashboard,
  enrollUserInCourse,
  createLearningGoal,
  generateStudyPlan,
  getWeakAreas,
  generateLessonSummary,
  getAcademyRecommendations,
  scheduleConceptReview,
  getDailyStudyPlan,
  getLearningRoadmap,
  getAcademyAnalytics,
  askTutorQuestion,
  completeLesson,
  getFirstLessonForCourse,
} from "../engines/academy/ErectorAcademyEngine.js";
import {
  getGoalsForTorgimaBlueprint,
  suggestLearningForOrder,
  scheduleStudySession,
  syncStudySessionToCalendar,
  awardXpForLearning,
  getLearningEvidence,
  getAlignmentWithTorgima,
  recommendCoursesForBlueprint,
} from "../engines/academy/AcademyIntegrationEngine.js";

const router = Router();

router.get("/academy", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const academyEnabled = await checkFeatureFlag(FEATURE_FLAGS.ACADEMY_ENABLED);
    if (!academyEnabled) {
      failure(res, "FEATURE_DISABLED", "Academy is not enabled", 403);
      return;
    }

    const tasks = await db
      .select()
      .from(academyTasks)
      .where(and(eq(academyTasks.user_id, auth.userId), ne(academyTasks.status, "completed")))
      .orderBy(desc(academyTasks.created_at))
      .limit(10);

    const proofHistory = await db
      .select()
      .from(academyProof)
      .where(eq(academyProof.user_id, auth.userId))
      .orderBy(desc(academyProof.created_at))
      .limit(5);

    const profile = await getOrCreateSkillProfile(auth.userId);

    const paths = await db
      .select()
      .from(learningPaths)
      .where(and(eq(learningPaths.user_id, auth.userId), eq(learningPaths.path_status, "ACTIVE")))
      .orderBy(desc(learningPaths.created_at));

    const gaps = await db
      .select()
      .from(capabilityGapLogs)
      .where(and(eq(capabilityGapLogs.user_id, auth.userId), eq(capabilityGapLogs.resolved, false)))
      .limit(10);

    success(res, {
      tasks,
      proofHistory,
      count: tasks.length,
      skillProfile: profile,
      activePaths: paths,
      activeGaps: gaps,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/skills", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [row] = await db
      .select()
      .from(skillProfiles)
      .where(eq(skillProfiles.user_id, auth.userId))
      .limit(1);

    success(res, {
      profile: row ?? null,
      skillScores: (row?.skill_scores as Record<string, number>) ?? {},
      masteredSkills: (row?.mastered_skills as string[]) ?? [],
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/morning-section", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const section = await getAcademyMorningSection(auth.userId);
    success(res, { academySection: section });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// ── PROMPT 2: Erector Academy learning platform ───────────────────────────────

const routerSchema = z.object({
  action: z.enum(["teach_me", "quiz_me", "explain_this", "practice", "show_progress", "grade"]),
  topic: z.string().optional(),
});

router.post("/academy/router", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = routerSchema.parse(req.body);
    const profile = await getOrCreateLearningProfile(auth.userId);
    const routed = routeAcademyRequest({ action: body.action, topic: body.topic, learningProfile: profile });
    success(res, routed);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/courses", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    await ensureAcademyCatalogSeeded();
    const courses = await db.select().from(academyCourses).orderBy(asc(academyCourses.title));
    success(res, { courses });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/course/:courseId/first-lesson", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const lesson = await getFirstLessonForCourse(req.params.courseId);
    if (!lesson) {
      failure(res, "NOT_FOUND", "No lessons in course", 404);
      return;
    }
    success(res, { lesson });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/course/:courseId/chapters", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const chapters = await db
      .select()
      .from(academyChapters)
      .where(eq(academyChapters.course_id, req.params.courseId))
      .orderBy(asc(academyChapters.chapter_number));
    success(res, { chapters });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/lessons/:lessonId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const content = await getLessonContent(req.params.lessonId);
    if (!content) {
      failure(res, "NOT_FOUND", "Lesson not found", 404);
      return;
    }
    const profile = await getOrCreateLearningProfile(auth.userId);
    const tutor = await buildTutorExplanation({
      userId: auth.userId,
      lessonId: req.params.lessonId,
      profile,
    });
    success(res, { ...content, tutor });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/practice/:lessonId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const practice = await getPracticeForLesson({
      userId: auth.userId,
      lessonId: req.params.lessonId,
      difficulty: req.query.difficulty ? Number(req.query.difficulty) : undefined,
    });
    if (!practice) {
      failure(res, "NOT_FOUND", "No practice items", 404);
      return;
    }
    success(res, practice);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/practice/:itemId/submit", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const userAnswer = z.string().min(1).parse(req.body.userAnswer);
    const result = await submitPracticeAttempt({
      userId: auth.userId,
      practiceItemId: req.params.itemId,
      userAnswer,
      timeTakenSeconds: req.body.timeTakenSeconds,
      isRetry: req.body.isRetry,
    });
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/evaluate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const userAnswer = z.string().min(1).parse(req.body.userAnswer);
    const result = await submitPracticeAttempt({
      userId: auth.userId,
      practiceItemId: z.string().uuid().parse(req.body.practiceItemId),
      userAnswer,
    });
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/learning-profile/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Cannot view another user's profile", 403);
      return;
    }
    const profile = await getOrCreateLearningProfile(auth.userId);
    const weak = await getWeakAreas(auth.userId);
    success(res, { profile, ...weak });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/progress/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, await getAcademyDashboard(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/my/dashboard", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await getAcademyDashboard(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/my/recommendations", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await getAcademyRecommendations(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/my/daily-study-plan", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await getDailyStudyPlan(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/my/analytics", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await getAcademyAnalytics(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/my/learning-profile", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const profile = await getOrCreateLearningProfile(auth.userId);
    const weak = await getWeakAreas(auth.userId);
    success(res, { profile, ...weak });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/dashboard/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, await getAcademyDashboard(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/enroll/:courseId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const enrollment = await enrollUserInCourse(auth.userId, req.params.courseId);
    success(res, { enrollment });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/create-learning-goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        goalTitle: z.string().min(3),
        targetSkill: z.string().min(2),
        targetMasteryLevel: z.number().int().min(0).max(100).optional(),
        deadline: z.string().optional(),
        alignedWithBlueprintId: z.string().uuid().optional(),
      })
      .parse(req.body);
    const goal = await createLearningGoal({ userId: auth.userId, ...body });
    success(res, { goal });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/generate-study-plan", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        learningGoalId: z.string().uuid(),
        sessionsPerWeek: z.number().int().optional(),
        minutesPerSession: z.number().int().optional(),
      })
      .parse(req.body);
    const plan = await generateStudyPlan({ userId: auth.userId, ...body });
    success(res, plan);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/weak-areas/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, await getWeakAreas(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/generate-summary/:lessonId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const row = await generateLessonSummary(auth.userId, req.params.lessonId);
    success(res, { summary: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/recommendations/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, await getAcademyRecommendations(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/schedule-review/:conceptId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await scheduleConceptReview(auth.userId, req.params.conceptId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/daily-study-plan/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, await getDailyStudyPlan(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/learning-roadmap/:goalId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, {
      roadmap: await getLearningRoadmap(req.params.goalId, auth.userId),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/analytics/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, await getAcademyAnalytics(auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/tutor-chat/ask", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        question: z.string().min(3),
        lessonId: z.string().uuid().optional(),
        topic: z.string().optional(),
      })
      .parse(req.body);
    success(res, await askTutorQuestion({ userId: auth.userId, ...body }));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/lessons/:lessonId/complete", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await completeLesson({
      userId: auth.userId,
      lessonId: req.params.lessonId,
      timeSpentSeconds: req.body.timeSpentSeconds,
      score: req.body.score,
    });
    success(res, { attempt: result });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/goals-for-torgima/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await getGoalsForTorgimaBlueprint(req.params.blueprintId, auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/alignment-with-torgima/:blueprintId", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    success(res, await getAlignmentWithTorgima(req.params.blueprintId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/recommend-courses/:blueprintId", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    success(res, { courses: await recommendCoursesForBlueprint(req.params.blueprintId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/suggest-learning-for-order/:orderId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await suggestLearningForOrder({ userId: auth.userId, orderId: req.params.orderId }));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/schedule-study-session", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        learningGoalId: z.string().uuid().optional(),
        scheduleId: z.string().uuid().optional(),
        sessionDate: z.string(),
        startTime: z.string(),
        durationMinutes: z.number().int().optional(),
      })
      .parse(req.body);
    const session = await scheduleStudySession({ userId: auth.userId, ...body });
    success(res, { session });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/sync-calendar/:studySessionId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await syncStudySessionToCalendar(req.params.studySessionId, auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/academy/award-xp/:userId/:conceptId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    const masteryLevel = z.number().min(0).max(100).parse(req.body.masteryLevel ?? 70);
    const blueprintId = z.string().uuid().optional().parse(req.body.blueprintId);
    success(
      res,
      await awardXpForLearning({
        userId: auth.userId,
        conceptId: req.params.conceptId,
        masteryLevel,
        blueprintId,
      }),
    );
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/academy/learning-evidence/:userId/:date", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, await getLearningEvidence(auth.userId, req.params.date));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// GET /api/academy/:blueprintId — active academy tasks for blueprint
router.get("/academy/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId!;
    const tasks = await db
      .select()
      .from(academyTasks)
      .where(
        and(
          eq(academyTasks.user_id, auth.userId),
          eq(academyTasks.blueprint_id, blueprintId),
          ne(academyTasks.status, "completed"),
        ),
      )
      .orderBy(desc(academyTasks.created_at));

    success(res, {
      tasks,
      blocksExecution: tasks.some((t) => t.blocks_execution),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// GET /api/academy/task/:taskId
router.get("/academy/task/:taskId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [task] = await db
      .select()
      .from(academyTasks)
      .where(
        and(eq(academyTasks.id, req.params.taskId!), eq(academyTasks.user_id, auth.userId)),
      )
      .limit(1);
    if (!task) {
      failure(res, "NOT_FOUND", "Academy task not found", 404);
      return;
    }
    success(res, { task });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/academy/:taskId/proof
router.post("/academy/:taskId/proof", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { validateAcademyProof } = await import("../engines/academy/AcademyEngine.js");
    const reflection = typeof req.body?.reflection === "string" ? req.body.reflection : "";
    const outputUrl = typeof req.body?.outputUrl === "string" ? req.body.outputUrl : undefined;

    const [task] = await db
      .select()
      .from(academyTasks)
      .where(
        and(eq(academyTasks.id, req.params.taskId!), eq(academyTasks.user_id, auth.userId)),
      )
      .limit(1);
    if (!task) {
      failure(res, "NOT_FOUND", "Academy task not found", 404);
      return;
    }

    const result = await validateAcademyProof(req.params.taskId!, { reflection, outputUrl });
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
