import { db, knowledgeObjects } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export type ExternalSignalType = "USER_UPLOAD" | "USER_LINK" | "USER_TEXT" | "SYSTEM_WEBHOOK";

export interface ExternalSignal {
  type:         ExternalSignalType;
  content:      string;
  metadata?:    Record<string, unknown>;
  sourceLabel?: string;
}

export async function ingestSignal(params: {
  userId:      string;
  blueprintId: string;
  signal:      ExternalSignal;
}): Promise<{ processed: boolean; routedTo: string[] }> {
  const routedTo: string[] = [];

  if (!params.signal.content || params.signal.content.trim().length < 2) {
    return { processed: false, routedTo: [] };
  }

  try {
    await db.insert(knowledgeObjects).values({
      blueprint_id: params.blueprintId,
      user_id:      params.userId,
      title:        params.signal.sourceLabel ?? `External signal: ${params.signal.type}`,
      content:      params.signal.content.slice(0, 2000),
      content_json: {
        signal_type: params.signal.type,
        metadata:    params.signal.metadata ?? {},
      },
      type:             "external_signal",
      applicable_level: "all",
      is_global:        false,
      active:           true,
    });
  } catch (err) {
    logger.warn({ err }, "[ExternalSignalGateway] knowledge insert failed");
    return { processed: false, routedTo: [] };
  }

  routedTo.push("knowledge_objects");

  const lower = params.signal.content.toLowerCase();
  if (lower.includes("completed") || lower.includes("result")) {
    await writeEvent({
      eventType:      EVENT_TYPES.EXTERNAL_SIGNAL_RECEIVED,
      entityType:     "blueprint",
      entityId:       params.blueprintId,
      userId:         params.userId,
      blueprintId:    params.blueprintId,
      payload:        {
        signal_type:    params.signal.type,
        content_preview: params.signal.content.slice(0, 200),
      },
      idempotencyKey: `ext_signal:${params.blueprintId}:${params.signal.type}:${Date.now()}`,
    }).catch(() => null);
    routedTo.push("outcome_validation");
  }

  logger.info(
    { blueprintId: params.blueprintId, type: params.signal.type, routedTo },
    "[ExternalSignalGateway] Signal ingested",
  );

  return { processed: true, routedTo };
}
