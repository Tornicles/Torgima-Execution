import { db, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger.js";
import {
  TierPreviewEngine,
  type TierPreviewCard,
} from "../engines/blueprint/TierPreviewEngine.js";

const PREVIEW_READY_STATUSES = new Set([
  "tier_presented",
  "tier_selected",
  "launched",
]);

/**
 * Build tier preview cards when validation is complete and previews are not ready yet.
 * Idempotent — safe after path_selection transition and before tier selection.
 */
export async function ensureTierPreviewsPresent(
  validationId: string,
  userId: string,
): Promise<TierPreviewCard[]> {
  const [row] = await db
    .select({
      tier_flow_status: validations.tier_flow_status,
      verdict: validations.verdict,
    })
    .from(validations)
    .where(and(eq(validations.id, validationId), eq(validations.user_id, userId)))
    .limit(1);

  if (!row) {
    return [];
  }

  if (row.verdict === "pivot") {
    return [];
  }

  if (row.tier_flow_status && PREVIEW_READY_STATUSES.has(row.tier_flow_status)) {
    const listed = await TierPreviewEngine.listPreviews(validationId, userId);
    if (listed.length > 0) {
      return listed;
    }
  }

  try {
    return await TierPreviewEngine.buildPreviews(validationId, userId);
  } catch (err) {
    logger.warn(
      {
        validationId,
        err: err instanceof Error ? err.message : String(err),
      },
      "[TierPreview] ensureTierPreviewsPresent failed",
    );
    return TierPreviewEngine.listPreviews(validationId, userId);
  }
}
