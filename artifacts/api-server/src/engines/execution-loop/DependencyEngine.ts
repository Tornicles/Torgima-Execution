/**
 * IL5 / DOC_26 — dependency gate before order publication.
 */
import {
  db,
  orders,
  feedback,
  orderDependencies,
  projectDependencies,
  projects,
  enforcementPackages,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { OrderStatus, ProjectStatus } from "@workspace/state-machine";

export type ResolutionTaskSpec = {
  task_type: string;
  title: string;
  instruction: string;
  expected_output: string;
  proof_required: boolean;
  proof_type: string;
  why_it_matters: string;
  difficulty?: string;
};

export type DependencyCheckResult = {
  executable: boolean;
  blockedBy?: string;
  resolutionTask?: ResolutionTaskSpec;
};

function blockerFromJson(blocker: Record<string, unknown> | null): {
  hadBlocker: boolean;
  blockerType?: string;
} {
  if (!blocker || typeof blocker !== "object") return { hadBlocker: false };
  const keys = Object.keys(blocker);
  if (keys.length === 0) return { hadBlocker: false };
  const blockerType =
    typeof blocker.blocker_type === "string"
      ? blocker.blocker_type
      : typeof blocker.type === "string"
        ? blocker.type
        : undefined;
  return { hadBlocker: true, blockerType };
}

export class DependencyEngine {
  async check(orderId: string): Promise<DependencyCheckResult> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return { executable: false, blockedBy: "Order not found" };
    }

    const orderDeps = await db
      .select()
      .from(orderDependencies)
      .where(
        and(
          eq(orderDependencies.blocked_order_id, orderId),
          eq(orderDependencies.status, "pending"),
        ),
      );

    for (const dep of orderDeps) {
      const [blocking] = await db
        .select({ id: orders.id, status: orders.status, title: orders.title })
        .from(orders)
        .where(eq(orders.id, dep.blocking_order_id))
        .limit(1);

      if (!blocking || blocking.status !== OrderStatus.COMPLETED) {
        return {
          executable: false,
          blockedBy: `Order ${dep.blocking_order_id} not yet completed`,
          resolutionTask: {
            task_type: "blocker_resolution",
            title: "Complete prerequisite task first",
            instruction: `Before proceeding, complete the required prior task${
              blocking?.title ? ` (“${blocking.title}”)` : ""
            }. It must be marked complete with proof before this task unlocks.`,
            expected_output: "Prior task completed with verified output.",
            proof_required: true,
            proof_type: "text",
            why_it_matters: "This task depends on a prior step being complete.",
            difficulty: "easy",
          },
        };
      }
    }

    if (order.linked_project_id) {
      const projDeps = await db
        .select()
        .from(projectDependencies)
        .where(
          and(
            eq(projectDependencies.blocked_project_id, order.linked_project_id),
            eq(projectDependencies.status, "PENDING"),
          ),
        );

      for (const pdep of projDeps) {
        const [blockingProject] = await db
          .select({ id: projects.id, name: projects.name, status: projects.status })
          .from(projects)
          .where(eq(projects.id, pdep.blocking_project_id))
          .limit(1);

        if (blockingProject && blockingProject.status !== ProjectStatus.COMPLETE) {
          return {
            executable: false,
            blockedBy: `Project ${pdep.blocking_project_id} not complete`,
            resolutionTask: {
              task_type: "blocker_resolution",
              title: "Complete prerequisite project first",
              instruction: `Finish project “${blockingProject.name ?? "prerequisite"}” before this order can run.`,
              expected_output: "Prerequisite project marked complete.",
              proof_required: true,
              proof_type: "text",
              why_it_matters: "This order is blocked by an upstream project dependency.",
              difficulty: "easy",
            },
          };
        }
      }
    }

    const [lastFeedback] = await db
      .select({ blocker_json: feedback.blocker_json, completion_status: feedback.completion_status })
      .from(feedback)
      .where(eq(feedback.order_id, orderId))
      .orderBy(desc(feedback.created_at))
      .limit(1);

    const blocker = blockerFromJson(
      (lastFeedback?.blocker_json ?? null) as Record<string, unknown> | null,
    );

    if (
      lastFeedback &&
      (lastFeedback.completion_status === "failed" || lastFeedback.completion_status === "skipped") &&
      blocker.hadBlocker &&
      blocker.blockerType &&
      order.task_type === "execution"
    ) {
      return {
        executable: false,
        blockedBy: blocker.blockerType,
        resolutionTask: {
          task_type: "blocker_resolution",
          title: `Resolve blocker: ${blocker.blockerType}`,
          instruction: `Identify and remove the blocker (${blocker.blockerType}) before returning to this task.`,
          expected_output: "Blocker removed or workaround documented.",
          proof_required: false,
          proof_type: "text",
          why_it_matters: "The blocker is preventing progress on your goal.",
          difficulty: "easy",
        },
      };
    }

    return { executable: true };
  }

  /** IL5 LAW 2 — insert executable resolution order (not a delay/hold). */
  async insertResolutionOrder(params: {
    blueprintId: string;
    userId: string;
    blockedOrderId: string;
    resolutionTask: ResolutionTaskSpec;
  }): Promise<string> {
    const [blocked] = await db
      .select({
        enforcement_package_id: orders.enforcement_package_id,
        linked_plan_id: orders.linked_plan_id,
        linked_phase_id: orders.linked_phase_id,
        linked_project_id: orders.linked_project_id,
        domain: orders.domain,
      })
      .from(orders)
      .where(eq(orders.id, params.blockedOrderId))
      .limit(1);

    let enforcementPackageId = blocked?.enforcement_package_id;
    if (!enforcementPackageId) {
      const [pkg] = await db
        .select({ id: enforcementPackages.id })
        .from(enforcementPackages)
        .where(
          and(
            eq(enforcementPackages.blueprint_id, params.blueprintId),
            eq(enforcementPackages.is_current, true),
          ),
        )
        .limit(1);
      enforcementPackageId = pkg?.id;
    }

    const spec = params.resolutionTask;

    const [created] = await db
      .insert(orders)
      .values({
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        enforcement_package_id: enforcementPackageId,
        linked_plan_id: blocked?.linked_plan_id,
        linked_phase_id: blocked?.linked_phase_id,
        linked_project_id: blocked?.linked_project_id,
        task_type: spec.task_type as typeof orders.$inferInsert["task_type"],
        title: spec.title,
        instruction: spec.instruction,
        expected_output: spec.expected_output,
        definition_of_done: spec.expected_output,
        why_it_matters: spec.why_it_matters,
        proof_required: spec.proof_required,
        proof_type: spec.proof_type as typeof orders.$inferInsert["proof_type"],
        difficulty: (spec.difficulty ?? "easy") as typeof orders.$inferInsert["difficulty"],
        priority: 90,
        status: OrderStatus.PENDING,
        generation_reason: `dependency_resolution_for:${params.blockedOrderId}`,
        domain: blocked?.domain ?? "delivery",
        trace_metadata: {
          dependency_resolution: true,
          blocked_order_id: params.blockedOrderId,
        },
      })
      .returning({ id: orders.id });

    if (!created?.id) throw new Error("Failed to insert dependency resolution order");

    await db
      .update(orders)
      .set({ status: OrderStatus.BLOCKED, blocker_description: params.resolutionTask.title })
      .where(eq(orders.id, params.blockedOrderId));

    logger.info(
      {
        blueprintId: params.blueprintId,
        blockedOrderId: params.blockedOrderId,
        resolutionOrderId: created.id,
      },
      "[DependencyEngine] Published resolution task instead of blocked execution order",
    );

    return created.id;
  }
}

export const dependencyEngine = new DependencyEngine();

/** Gate publication: returns order id safe to expose (may replace with resolution task). */
export async function resolvePublishableOrder(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
}): Promise<{ orderId: string; replaced: boolean; blockedBy?: string }> {
  const engine = new DependencyEngine();
  const check = await engine.check(params.orderId);

  if (check.executable || !check.resolutionTask) {
    return { orderId: params.orderId, replaced: false };
  }

  const resolutionId = await engine.insertResolutionOrder({
    blueprintId: params.blueprintId,
    userId: params.userId,
    blockedOrderId: params.orderId,
    resolutionTask: check.resolutionTask,
  });

  return {
    orderId: resolutionId,
    replaced: true,
    blockedBy: check.blockedBy,
  };
}

/** Mark dependencies satisfied when prerequisite order completes. */
export async function markOrderDependenciesSatisfied(completedOrderId: string): Promise<void> {
  await db
    .update(orderDependencies)
    .set({ status: "satisfied", resolved_at: new Date() })
    .where(
      and(
        eq(orderDependencies.blocking_order_id, completedOrderId),
        eq(orderDependencies.status, "pending"),
      ),
    );
}

export { checkExecutability, createDependency } from "../dependency/DependencyEngine.js";
