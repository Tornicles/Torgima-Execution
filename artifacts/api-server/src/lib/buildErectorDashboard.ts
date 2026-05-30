/**
 * Erector Dashboard — aggregates validation, simulation, academy, and industry data.
 */
import {
  db,
  validations,
  blueprints,
  bhudhiSimulationRuns,
  bhudhiSimulationScores,
  academyStudentEnrollments,
  academyCourses,
  academyTasks,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { BlueprintStatus, ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { getAcademyDashboard } from "../engines/academy/ErectorAcademyEngine.js";

export interface ErectorDashboardPanels {
  activeBlueprintId: string | null;
  recentValidations: Array<{
    id: string;
    name: string;
    description: string;
    verdict: string;
    verdictLabel: string;
    date: string;
    realityScorePercent: number;
    href: string;
  }>;
  simulationScenarios: Array<{
    id: string;
    question: string;
    projectName: string | null;
    impactPercent: number;
    impactLabel: string;
    condition: string;
    href: string | null;
  }>;
  industrySnapshot: {
    available: boolean;
    validationId: string | null;
    marketMomentum: { status: string; changeLabel: string | null };
    competitionLevel: { status: string; subtext: string };
    opportunityWindow: { status: string; subtext: string; percent: number };
    riskLevel: { status: string; subtext: string };
    topOpportunity: { title: string; description: string };
    insight: string | null;
    href: string | null;
  };
  learningProgress: Array<{
    id: string;
    courseName: string;
    courseType: string;
    progressPercent: number;
    action: "Continue" | "Review";
    href: string;
  }>;
  links: {
    simulatorHref: string | null;
    industryHref: string | null;
  };
}

function verdictLabel(verdict: string | null): string {
  const v = (verdict ?? "").toLowerCase();
  if (v === "proceed" || v === "go") return "Proceed";
  if (v === "pivot") return "Pivot";
  if (v === "blocked") return "Blocked";
  return "Adjust";
}

function realityScorePercent(row: {
  reality_score: number | null;
  clarity_score: number | null;
  feasibility_score: number | null;
  realism_score: number | null;
  overall_score: number | null;
}): number {
  if (row.reality_score != null) {
    const r = Number(row.reality_score);
    return Math.min(100, Math.max(0, Math.round(r <= 10 ? r * 10 : r)));
  }
  if (row.overall_score != null) {
    return Math.min(100, Math.max(0, Math.round(Number(row.overall_score))));
  }
  const c = Number(row.clarity_score ?? 0);
  const f = Number(row.feasibility_score ?? 0);
  const r = Number(row.realism_score ?? 0);
  if (c + f + r > 0) {
    const avg = (c + f + r) / 3;
    return Math.min(100, Math.max(0, Math.round(avg <= 10 ? avg * 10 : avg)));
  }
  return 0;
}

function isValidationComplete(row: typeof validations.$inferSelect): boolean {
  if (row.validation_kind === ValidationKind.ERECTOR) {
    const stage = row.erector_validation_stage ?? row.validation_stage ?? row.status;
    return (
      stage === ErectorValidationStage.COMPLETE ||
      stage === ValidationStatus.COMPLETE ||
      stage === "complete"
    );
  }
  return row.status === ValidationStatus.COMPLETE || row.status === "complete" || Boolean(row.is_finalized);
}

function ideaTitle(row: typeof validations.$inferSelect): string {
  const goal = row.goal_final?.trim() || row.raw_goal?.trim();
  if (goal) return goal.length > 80 ? `${goal.slice(0, 77)}…` : goal;
  const archetype = row.archetype_resolution as { primaryArchetype?: { name?: string } } | null;
  if (archetype?.primaryArchetype?.name) return archetype.primaryArchetype.name;
  if (row.business_type) return row.business_type;
  return "Validation run";
}

function ideaDescription(row: typeof validations.$inferSelect): string {
  return (
    row.ai_summary?.trim()?.slice(0, 120) ||
    row.recommendation?.trim()?.slice(0, 120) ||
    row.purpose_final?.trim()?.slice(0, 120) ||
    row.raw_purpose?.trim()?.slice(0, 120) ||
    "Erector validation analysis"
  );
}

function conditionFromText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("collapse") || t.includes("stress") || t.includes("survival") || t.includes("danger")) {
    return "SURVIVAL";
  }
  if (t.includes("growth") || t.includes("scale") || t.includes("expand")) {
    return "GROWTH";
  }
  if (t.includes("urgency") || t.includes("stabil")) {
    return "STABILITY";
  }
  return "STABILITY";
}

function buildIndustrySnapshot(
  row: typeof validations.$inferSelect | null,
): ErectorDashboardPanels["industrySnapshot"] {
  if (!row) {
    return {
      available: false,
      validationId: null,
      marketMomentum: { status: "—", changeLabel: null },
      competitionLevel: { status: "—", subtext: "Run a validation first" },
      opportunityWindow: { status: "—", subtext: "—", percent: 0 },
      riskLevel: { status: "—", subtext: "—" },
      topOpportunity: { title: "—", description: "Complete validation to unlock industry intelligence" },
      insight: null,
      href: null,
    };
  }

  const intel = row.intelligence_payload as {
    industryPanel?: {
      industryOverview?: Record<string, string | string[]>;
      demandIntelligence?: Record<string, string | string[]>;
      competitiveLandscape?: Record<string, string | string[]>;
      strategicWindows?: Record<string, string | string[]>;
      riskMap?: Array<{ title: string; level: string }>;
    };
  } | null;

  const panel = intel?.industryPanel;
  const stored = row.industry_intelligence as Record<string, unknown> | null;
  const briefing = row.economy_briefing as {
    keyOpportunities?: string[];
    keyWarnings?: string[];
    briefingNarrative?: string;
  } | null;

  const overview = panel?.industryOverview ?? {};
  const demand = panel?.demandIntelligence ?? {};
  const competitive = panel?.competitiveLandscape ?? {};
  const windows = panel?.strategicWindows ?? {};

  const health = String(overview.health ?? stored?.health ?? "Stable");
  const momentumStatus =
    health.toLowerCase().includes("grow") || demand.direction === "rising"
      ? "Rising"
      : health.toLowerCase().includes("declin")
        ? "Declining"
        : "Stable";

  const threat = String(
    competitive.threatLevel ?? competitive.saturation ?? stored?.competitionLevel ?? "Moderate",
  );
  const timing = String(windows.timing ?? windows.opportunityWindow ?? "Good");
  const topOpp =
    briefing?.keyOpportunities?.[0] ??
    (Array.isArray(windows.leverageTrends) ? String(windows.leverageTrends[0]) : null) ??
    String(demand.topDrivers ?? "Market opportunity");

  const risks = panel?.riskMap ?? [];
  const riskLevel =
    risks.some((r) => r.level === "critical" || r.level === "high")
      ? "High"
      : risks.some((r) => r.level === "medium")
        ? "Medium"
        : "Low";

  const insight =
    briefing?.briefingNarrative?.trim()?.slice(0, 280) ||
    briefing?.keyOpportunities?.slice(0, 2).join(". ") ||
    null;

  const oppPercent =
    momentumStatus === "Rising"
      ? 72
      : momentumStatus === "Declining"
        ? 35
        : 58;

  return {
    available: true,
    validationId: row.id,
    marketMomentum: {
      status: momentumStatus,
      changeLabel:
        row.momentum_potential != null
          ? `${row.momentum_potential >= 0 ? "+" : ""}${Math.round(Number(row.momentum_potential) * 10)}% momentum signal`
          : null,
    },
    competitionLevel: {
      status: threat.length > 20 ? `${threat.slice(0, 18)}…` : threat,
      subtext: String(competitive.gapOpportunities ?? "Manageable with positioning"),
    },
    opportunityWindow: {
      status: timing.length > 24 ? `${timing.slice(0, 22)}…` : timing,
      subtext: String(windows.horizon ?? "Next 6–12 months"),
      percent: oppPercent,
    },
    riskLevel: {
      status: riskLevel,
      subtext: briefing?.keyWarnings?.[0]?.slice(0, 60) ?? "Stay aware",
    },
    topOpportunity: {
      title: typeof topOpp === "string" ? topOpp.slice(0, 48) : "Emerging opportunity",
      description:
        typeof demand.strength === "string"
          ? `${demand.strength} demand signal`
          : "High demand with differentiated entry",
    },
    insight,
    href: `/validation/${row.id}/results`,
  };
}

export async function buildErectorDashboard(userId: string): Promise<ErectorDashboardPanels> {
  const [activeBp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.status, BlueprintStatus.ACTIVE)))
    .limit(1);

  const activeBlueprintId = activeBp?.id ?? null;

  const validationRows = await db
    .select()
    .from(validations)
    .where(eq(validations.user_id, userId))
    .orderBy(desc(validations.created_at))
    .limit(12);

  const completeRows = validationRows.filter(isValidationComplete);
  const recentValidations = completeRows.slice(0, 6).map((row) => ({
    id: row.id,
    name: ideaTitle(row),
    description: ideaDescription(row),
    verdict: row.verdict ?? "adjust",
    verdictLabel: verdictLabel(row.verdict),
    date: row.created_at.toISOString().slice(0, 10),
    realityScorePercent: realityScorePercent(row),
    href: `/validation/${row.id}/results`,
  }));

  let simulationScenarios: ErectorDashboardPanels["simulationScenarios"] = [];
  if (activeBlueprintId) {
    const runs = await db
      .select({
        run: bhudhiSimulationRuns,
        score: bhudhiSimulationScores.overall,
      })
      .from(bhudhiSimulationRuns)
      .leftJoin(bhudhiSimulationScores, eq(bhudhiSimulationScores.run_id, bhudhiSimulationRuns.id))
      .where(eq(bhudhiSimulationRuns.blueprint_id, activeBlueprintId))
      .orderBy(desc(bhudhiSimulationRuns.created_at))
      .limit(8);

    const [bpTitle] = await db
      .select({ title: blueprints.title, goal: blueprints.goal })
      .from(blueprints)
      .where(eq(blueprints.id, activeBlueprintId))
      .limit(1);

    const projectName = bpTitle?.title ?? bpTitle?.goal ?? null;

    simulationScenarios = runs.map((r) => {
      const overall = r.score ?? 50;
      const impact = overall - 50;
      const rec = r.run.recommendation ?? "";
      const goal = r.run.goal ?? "Scenario simulation";
      const question =
        goal.length > 10 && !goal.startsWith("Simulation")
          ? goal
          : rec.length > 20
            ? rec.slice(0, 100)
            : `Simulation run ${r.run.simulation_id.slice(0, 8)}`;
      return {
        id: r.run.simulation_id,
        question,
        projectName,
        impactPercent: impact,
        impactLabel: `${impact >= 0 ? "+" : ""}${impact}% Impact`,
        condition: conditionFromText(`${rec} ${goal}`),
        href: `/app/bhudhi/erector?blueprintId=${activeBlueprintId}`,
      };
    });
  }

  const industryRow = completeRows[0] ?? validationRows.find(isValidationComplete) ?? null;
  const industrySnapshot = buildIndustrySnapshot(industryRow ?? null);

  const learningProgress: ErectorDashboardPanels["learningProgress"] = [];

  try {
    const academy = await getAcademyDashboard(userId);
    for (const e of academy.enrollments.slice(0, 6)) {
      const pct = Math.min(100, Math.max(0, Number(e.progress_percent ?? 0)));
      learningProgress.push({
        id: e.id,
        courseName: e.courseTitle ?? "Course",
        courseType: e.category ?? "Skill",
        progressPercent: pct,
        action: pct >= 90 ? "Review" : "Continue",
        href: `/academy/course/${e.course_id}`,
      });
    }
  } catch {
    /* academy optional */
  }

  if (learningProgress.length === 0) {
    const tasks = await db
      .select({
        id: academyTasks.id,
        title: academyTasks.title,
        skill_area: academyTasks.skill_area,
        status: academyTasks.status,
      })
      .from(academyTasks)
      .where(eq(academyTasks.user_id, userId))
      .orderBy(desc(academyTasks.created_at))
      .limit(4);

    for (const t of tasks) {
      const done = t.status === "completed";
      learningProgress.push({
        id: t.id,
        courseName: t.title,
        courseType: t.skill_area ?? "Academy",
        progressPercent: done ? 100 : 0,
        action: done ? "Review" : "Continue",
        href: "/knowledge",
      });
    }
  }

  if (learningProgress.length === 0) {
    const courses = await db.select().from(academyCourses).orderBy(academyCourses.title).limit(4);
    for (const c of courses) {
      const [enr] = await db
        .select({ progress_percent: academyStudentEnrollments.progress_percent })
        .from(academyStudentEnrollments)
        .where(
          and(
            eq(academyStudentEnrollments.user_id, userId),
            eq(academyStudentEnrollments.course_id, c.id),
          ),
        )
        .limit(1);
      const pct = enr?.progress_percent ?? 0;
      learningProgress.push({
        id: c.id,
        courseName: c.title,
        courseType: c.category,
        progressPercent: pct,
        action: pct >= 90 ? "Review" : "Continue",
        href: `/academy/course/${c.id}`,
      });
    }
  }

  return {
    activeBlueprintId,
    recentValidations,
    simulationScenarios,
    industrySnapshot,
    learningProgress,
    links: {
      simulatorHref: activeBlueprintId ? `/app/bhudhi/erector?blueprintId=${activeBlueprintId}` : null,
      industryHref: industrySnapshot.href,
    },
  };
}
