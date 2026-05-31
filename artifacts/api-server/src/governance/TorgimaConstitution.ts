import { db, blueprints, orders, feedback, signalSnapshots, enforcementPackages } from "@workspace/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const DIFFICULTY_ORDER = ["trivial", "easy", "moderate", "hard", "very_hard"] as const;

export type ConstitutionArticleKey =
  | "article1"
  | "article2"
  | "article3"
  | "article4"
  | "article5"
  | "article6"
  | "article7";

export type ArticleAuditResult = {
  compliant: boolean;
  details: Record<string, unknown>;
};

export const TORGIMA_CONSTITUTION = {
  article1: {
    law: "Signals define execution reality. No human, AI, or process may override a calculated signal.",
    enforcement: "SignalCalculationEngine is the sole authority on signal values",
    audit: async (blueprintId: string): Promise<ArticleAuditResult> => {
      const [fb] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(feedback)
        .where(eq(feedback.blueprint_id, blueprintId));
      const [sig] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(signalSnapshots)
        .where(eq(signalSnapshots.blueprint_id, blueprintId));
      const feedbackCount = fb?.count ?? 0;
      const signalCount = sig?.count ?? 0;
      const compliant = signalCount >= Math.floor(feedbackCount * 0.95);
      return { compliant, details: { feedbackCount, signalCount } };
    },
  },
  article2: {
    law: "Condition is the enforcement state. Task generation obeys condition without exception.",
    enforcement: "ConditionEvaluationEngine assigns condition; EnforcementPackageGenerator applies it",
    audit: async (blueprintId: string): Promise<ArticleAuditResult> => {
      const [enf] = await db
        .select()
        .from(enforcementPackages)
        .where(
          and(
            eq(enforcementPackages.blueprint_id, blueprintId),
            eq(enforcementPackages.is_current, true),
          ),
        )
        .limit(1);
      const cap = enf?.difficulty_cap ?? "very_hard";
      const capIdx = DIFFICULTY_ORDER.indexOf(cap as (typeof DIFFICULTY_ORDER)[number]);
      const activeTasks = await db
        .select({ difficulty: orders.difficulty })
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, blueprintId),
            inArray(orders.status, ["pending", "active", "needs_feedback"]),
          ),
        );
      const violating = activeTasks.filter((t) => {
        const idx = DIFFICULTY_ORDER.indexOf(
          (t.difficulty ?? "moderate") as (typeof DIFFICULTY_ORDER)[number],
        );
        return idx > capIdx;
      });
      return {
        compliant: violating.length === 0,
        details: { violations: violating.length, difficultyCap: cap },
      };
    },
  },
  article3: {
    law: "No order may exist without hierarchy traceability to blueprint.",
    enforcement: "TaskGenerationEngine links every order to blueprint position",
    audit: async (blueprintId: string): Promise<ArticleAuditResult> => {
      const orphan = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.blueprint_id, blueprintId), isNull(orders.action_id)))
        .limit(10);
      return { compliant: orphan.length === 0, details: { orphanCount: orphan.length } };
    },
  },
  article6: {
    law: "An active blueprint must have at least one pending order when execution is active.",
    enforcement: "ContinuousTaskGuaranteeEngine",
    audit: async (blueprintId: string): Promise<ArticleAuditResult> => {
      const [bp] = await db
        .select({ status: blueprints.status, active: blueprints.active })
        .from(blueprints)
        .where(eq(blueprints.id, blueprintId))
        .limit(1);
      if (!bp?.active || bp.status !== "active") {
        return { compliant: true, details: { skipped: true } };
      }
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, blueprintId),
            inArray(orders.status, ["pending", "active", "needs_feedback"]),
          ),
        );
      const taskCount = row?.count ?? 0;
      return { compliant: taskCount > 0, details: { taskCount } };
    },
  },
} as const;

export type ConstitutionViolation = {
  blueprintId: string;
  article: ConstitutionArticleKey;
  law: string;
  details: Record<string, unknown>;
  repaired?: boolean;
};

export type ConstitutionAuditReport = {
  ran_at: string;
  blueprints_checked: number;
  violations_found: number;
  violations_auto_repaired: number;
  violations: ConstitutionViolation[];
};

export async function autoRepairConstitutionViolation(
  blueprintId: string,
  article: ConstitutionArticleKey,
): Promise<boolean> {
  if (article === "article6") {
    try {
      const { writeEvent, EVENT_TYPES } = await import("../services/EventService.js");
      await writeEvent({
        eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
        entityType: "blueprint",
        entityId: blueprintId,
        blueprintId,
        payload: { trigger: "constitution_repair" },
        idempotencyKey: `constitution_repair:${blueprintId}:${Date.now()}`,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function runConstitutionAudit(): Promise<ConstitutionAuditReport> {
  const activeBlueprints = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

  const violations: ConstitutionViolation[] = [];

  for (const blueprint of activeBlueprints) {
    for (const [articleKey, article] of Object.entries(TORGIMA_CONSTITUTION)) {
      if (!("audit" in article) || typeof article.audit !== "function") continue;
      const result = await article.audit(blueprint.id);
      if (!result.compliant) {
        const repaired = await autoRepairConstitutionViolation(
          blueprint.id,
          articleKey as ConstitutionArticleKey,
        );
        violations.push({
          blueprintId: blueprint.id,
          article: articleKey as ConstitutionArticleKey,
          law: article.law,
          details: result.details,
          repaired,
        });
      }
    }
  }

  if (violations.length > 0) {
    logger.error(
      { count: violations.length },
      "[CONSTITUTION AUDIT] Violations found",
    );
  }

  return {
    ran_at: new Date().toISOString(),
    blueprints_checked: activeBlueprints.length,
    violations_found: violations.length,
    violations_auto_repaired: violations.filter((v) => v.repaired).length,
    violations,
  };
}
