/**
 * Prompt 10 — deterministic capability gap detection; Bhudhi assesses severity only.
 */
import { db, skillProfiles, capabilityGapLogs, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export const SKILL_CATEGORIES: Record<string, string[]> = {
  Content: [
    "content_ideation",
    "hook_writing",
    "script_structure",
    "filming_technique",
    "editing_technique",
    "platform_optimization",
    "audience_growth",
    "consistency_systems",
  ],
  Growth: [
    "funnel_construction",
    "conversion_optimization",
    "traffic_acquisition",
    "retention_mechanics",
    "analytics_reading",
  ],
  Operations: [
    "process_design",
    "delegation",
    "team_communication",
    "project_tracking",
    "systems_thinking",
  ],
  Market: ["positioning", "offer_design", "competitive_analysis", "pricing_strategy"],
  delivery: ["execution_quality", "client_communication", "delivery_systems"],
};

export type GapSeverity = "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";

export interface CapabilityGap {
  skillCategory: string;
  severity: GapSeverity;
  evidenceSources: string[];
  currentScore: number;
  targetScore: number;
  estimatedLessons: number;
}

function mapDomain(raw: string | null | undefined): string {
  const d = (raw ?? "Content").trim();
  if (SKILL_CATEGORIES[d]) return d;
  const lower = d.toLowerCase();
  if (lower.includes("content") || lower.includes("creator")) return "Content";
  if (lower.includes("growth") || lower.includes("market")) return "Growth";
  if (lower.includes("ops") || lower.includes("operation")) return "Operations";
  return "Content";
}

function inferSkillCategory(params: {
  reflection: string;
  instruction: string;
  actionType?: string;
  domain: string;
}): string {
  const text = `${params.reflection} ${params.instruction} ${params.actionType ?? ""}`.toLowerCase();
  const cats = SKILL_CATEGORIES[params.domain] ?? SKILL_CATEGORIES.Content;
  if (text.includes("hook") || text.includes("opening")) return "hook_writing";
  if (text.includes("edit")) return "editing_technique";
  if (text.includes("film") || text.includes("camera")) return "filming_technique";
  if (text.includes("script") || text.includes("structure")) return "script_structure";
  if (text.includes("audience") || text.includes("follower")) return "audience_growth";
  if (text.includes("idea") || text.includes("topic")) return "content_ideation";
  if (text.includes("funnel")) return "funnel_construction";
  if (text.includes("analytics") || text.includes("metric")) return "analytics_reading";
  return cats[0] ?? "content_ideation";
}

export function severityFromScore(current: number, failurePattern: number): GapSeverity {
  if (current < 0.15) return "BLOCKING";
  if (current < 0.3) return "HIGH";
  if (current < 0.45) return "MEDIUM";
  if (failurePattern > 2) return "MEDIUM";
  return "LOW";
}

function lessonCountForSeverity(severity: GapSeverity): number {
  switch (severity) {
    case "BLOCKING":
      return 5;
    case "HIGH":
      return 4;
    case "MEDIUM":
      return 3;
    default:
      return 2;
  }
}

export async function getOrCreateSkillProfile(userId: string, domainHint?: string): Promise<{
  domain: string;
  skillScores: Record<string, number>;
  masteredSkills: string[];
}> {
  const domain = mapDomain(domainHint);
  const [row] = await db.select().from(skillProfiles).where(eq(skillProfiles.user_id, userId)).limit(1);

  if (row) {
    return {
      domain: row.domain,
      skillScores: (row.skill_scores as Record<string, number>) ?? {},
      masteredSkills: (row.mastered_skills as string[]) ?? [],
    };
  }

  const defaults: Record<string, number> = {};
  for (const cat of SKILL_CATEGORIES[domain] ?? []) {
    defaults[cat] = 0.35;
  }

  await db.insert(skillProfiles).values({
    user_id: userId,
    domain,
    skill_scores: defaults,
  });

  return { domain, skillScores: defaults, masteredSkills: [] };
}

export async function assessSkillLevel(userId: string, skillCategory: string): Promise<number> {
  const profile = await getOrCreateSkillProfile(userId);
  return profile.skillScores[skillCategory] ?? 0.35;
}

export async function detectCapabilityGap(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  reflection: string;
  instruction: string;
  actionType?: string;
  failureCategory: string;
}): Promise<CapabilityGap | null> {
  if (params.failureCategory !== "CAPABILITY_GAP") return null;

  const [bp] = await db
    .select({ domain_hint: blueprints.domain_hint, current_domain: blueprints.current_domain })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const domain = mapDomain(bp?.domain_hint ?? bp?.current_domain ?? "Content");
  const profile = await getOrCreateSkillProfile(params.userId, domain);

  const skillCategory = inferSkillCategory({
    reflection: params.reflection,
    instruction: params.instruction,
    actionType: params.actionType,
    domain,
  });

  if (profile.masteredSkills.includes(skillCategory)) {
    logger.info({ userId: params.userId, skillCategory }, "[CapabilityGap] Skill already mastered — skip");
    return null;
  }

  const currentScore = profile.skillScores[skillCategory] ?? 0.35;
  const severity = severityFromScore(currentScore, 1);
  const targetScore = Math.min(0.75, currentScore + 0.25);

  if (severity === "LOW") return null;

  return {
    skillCategory,
    severity,
    evidenceSources: ["FAILURE_CLASSIFICATION", params.failureCategory],
    currentScore,
    targetScore,
    estimatedLessons: lessonCountForSeverity(severity),
  };
}

export async function logCapabilityGap(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  gap: CapabilityGap;
  learningPathId?: string;
}): Promise<string> {
  const [row] = await db
    .insert(capabilityGapLogs)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      order_id: params.orderId,
      gap_type: params.gap.skillCategory,
      detected_from: "FAILURE_CLASSIFICATION",
      severity: params.gap.severity,
      learning_path_id: params.learningPathId ?? null,
      metadata_json: {
        currentScore: params.gap.currentScore,
        targetScore: params.gap.targetScore,
        estimatedLessons: params.gap.estimatedLessons,
      },
    })
    .returning({ id: capabilityGapLogs.id });

  return row!.id;
}

export async function getActiveCapabilityGaps(userId: string) {
  return db
    .select()
    .from(capabilityGapLogs)
    .where(and(eq(capabilityGapLogs.user_id, userId), eq(capabilityGapLogs.resolved, false)));
}

export async function hasBlockingGap(userId: string, skillCategory: string): Promise<boolean> {
  const gaps = await getActiveCapabilityGaps(userId);
  return gaps.some(
    (g) => g.gap_type === skillCategory && (g.severity === "BLOCKING" || g.severity === "HIGH"),
  );
}

export function sanitizeAcademyLanguage(text: string): string {
  return text
    .replace(/\btraining\b/gi, "capability development")
    .replace(/\bstudy this\b/gi, "apply this capability")
    .replace(/\blearning\b/gi, "skill progression")
    .replace(/\bquiz\b/gi, "mastery evidence")
    .replace(/\blesson\b/gi, "execution step");
}

const FORBIDDEN_ACADEMY_TERMS = /\b(training|study|learning)\b/i;

export function hasForbiddenAcademyLanguage(text: string): boolean {
  return FORBIDDEN_ACADEMY_TERMS.test(text) || /\blesson\b/i.test(text);
}

export function inferSkillFromActionType(
  actionType: string | null | undefined,
  domainHint?: string | null,
): string | null {
  if (!actionType) return null;
  const domain = mapDomain(domainHint ?? "Content");
  const text = actionType.toLowerCase();
  if (text.includes("edit")) return "editing_technique";
  if (text.includes("publish") || text.includes("post")) return "platform_optimization";
  if (text.includes("film") || text.includes("record")) return "filming_technique";
  if (text.includes("write") || text.includes("script")) return "script_structure";
  if (text.includes("analyze")) return "analytics_reading";
  return (SKILL_CATEGORIES[domain] ?? [])[0] ?? null;
}

/** Lower skill scores → longer paths (Prompt 10 TEST 3). */
export function lessonSequenceLengthForScore(currentScore: number, severity: GapSeverity): number {
  const base =
    severity === "BLOCKING" ? 5 : severity === "HIGH" ? 4 : severity === "MEDIUM" ? 3 : 2;
  if (currentScore <= 0.1) return Math.min(5, base + 1);
  if (currentScore <= 0.2) return base;
  if (currentScore >= 0.35) return Math.max(2, base - 1);
  return base;
}
