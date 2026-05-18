import { Router } from "express";
import { db, academyTasks, academyProof, skillProfiles, learningPaths, capabilityGapLogs } from "@workspace/db";
import { and, desc, eq, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { getOrCreateSkillProfile } from "../engines/academy/CapabilityGapEngine.js";
import { getAcademyMorningSection } from "../engines/academy/LearningPathGenerator.js";

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

export default router;
