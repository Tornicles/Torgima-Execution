import { db, blueprints, inactivityRecords, pivotReviews } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEventInTx, EVENT_TYPES } from "../../services/EventService.js";
import { TorgimaError } from "../../lib/errors.js";
import { notifyBlueprintPaused } from "../../services/notification/LifecycleNotificationWiring.js";

const NOTHINGNESS = "nothingness";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function pauseBlueprint(params: {
  blueprintId: string;
  userId: string;
  reason?: string;
}): Promise<void> {
  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(
      and(
        eq(blueprints.id, params.blueprintId),
        eq(blueprints.user_id, params.userId),
        eq(blueprints.active, true),
      ),
    )
    .limit(1);

  if (!blueprint) {
    throw new TorgimaError("NOT_FOUND", "No active blueprint found", false);
  }
  if (blueprint.status === "paused") {
    throw new TorgimaError("BLUEPRINT_PAUSED", "Blueprint is already paused", false);
  }
  if (blueprint.status === "complete") {
    throw new TorgimaError("BLUEPRINT_COMPLETE", "Cannot pause a completed blueprint", false);
  }
  if (blueprint.status !== "active") {
    throw new TorgimaError("BLUEPRINT_NOT_ACTIVE", "Blueprint must be active to pause", false);
  }

  if (blueprint.current_condition === NOTHINGNESS) {
    throw new TorgimaError(
      "BLUEPRINT_NOT_ACTIVE",
      "Cannot pause in Nothingness — execution has not started meaningfully",
      false,
    );
  }

  const [openPivot] = await db
    .select({ id: pivotReviews.id })
    .from(pivotReviews)
    .where(and(eq(pivotReviews.blueprint_id, params.blueprintId), eq(pivotReviews.status, "open")))
    .limit(1);

  if (openPivot) {
    throw new TorgimaError("PIVOT_REVIEW_OPEN", "Resolve the open pivot review before pausing", false);
  }

  const now = new Date();

  await db.transaction(async (tx: Tx) => {
    await tx
      .update(blueprints)
      .set({
        status: "paused",
        paused_at: now,
        pause_reason: params.reason ?? null,
        active: true,
        state_version: sql`${blueprints.state_version} + 1`,
      })
      .where(eq(blueprints.id, params.blueprintId));

    await tx
      .update(inactivityRecords)
      .set({ resolved: true, resolved_at: now })
      .where(
        and(eq(inactivityRecords.blueprint_id, params.blueprintId), eq(inactivityRecords.resolved, false)),
      );

    await writeEventInTx(
      {
        eventType: EVENT_TYPES.BLUEPRINT_PAUSED,
        entityType: "blueprint",
        entityId: params.blueprintId,
        userId: params.userId,
        blueprintId: params.blueprintId,
        payload: { reason: params.reason ?? null, paused_at: now.toISOString() },
        idempotencyKey: `blueprint_paused:${params.blueprintId}:${now.getTime()}`,
      },
      tx,
    );
  });

  await notifyBlueprintPaused({ userId: params.userId, blueprintId: params.blueprintId }).catch(() => null);

  logger.info({ blueprintId: params.blueprintId, userId: params.userId, reason: params.reason }, "[PauseEngine] Blueprint paused");
}

export class PauseEngine {
  pauseBlueprint(p: { blueprintId: string; userId: string; reason?: string }) {
    return pauseBlueprint(p);
  }
}
