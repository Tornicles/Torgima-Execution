/**
 * GAP G8 — External Signal Integration Gateway (DOC_27).
 * LAW 1: auth → validate → trust → normalize → store → event (never direct canonical mutation).
 * LAW 2: append-only external_signals rows.
 */

import { db, externalSignals } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import {
  resolveSourceTrust,
  confidenceFromTrust,
  type ExternalTrustLevel,
} from "./ExternalSignalTrust.js";
import { normalizeExternalPayload } from "./ExternalSignalNormalizer.js";

export type ExternalSignalReceiveInput = {
  userId: string;
  blueprintId?: string;
  sourceName: string;
  sourceType: string;
  rawPayload: Record<string, unknown>;
  signature?: string;
  signalType?: string;
};

export type ExternalSignalReceiveResult =
  | { accepted: true; signal_id: string; trust_level: ExternalTrustLevel }
  | { accepted: false; reason: string };

export class ExternalSignalGateway {
  async receive(input: ExternalSignalReceiveInput): Promise<ExternalSignalReceiveResult> {
    if (!input.userId?.trim()) {
      return { accepted: false, reason: "user_id is required" };
    }

    const trustLevel = resolveSourceTrust(input.sourceName);
    if (trustLevel === "UNTRUSTED") {
      return { accepted: false, reason: "Unknown or untrusted source" };
    }

    if (!input.rawPayload || typeof input.rawPayload !== "object" || Array.isArray(input.rawPayload)) {
      return { accepted: false, reason: "Invalid payload structure" };
    }

    const normalized = await normalizeExternalPayload(input.sourceName, input.rawPayload);
    const confidence = confidenceFromTrust(trustLevel);
    const signalType =
      input.signalType ??
      (typeof input.rawPayload.type === "string" ? input.rawPayload.type : "external_metric");

    const [signal] = await db
      .insert(externalSignals)
      .values({
        user_id: input.userId,
        blueprint_id: input.blueprintId ?? null,
        source_type: input.sourceType,
        source_name: input.sourceName,
        trust_level: trustLevel,
        confidence,
        signal_type: signalType,
        payload: input.rawPayload,
        normalized_payload: normalized,
        status: "PENDING",
        processed_at: null,
      })
      .returning({ id: externalSignals.id });

    if (!signal) {
      return { accepted: false, reason: "Failed to persist external signal" };
    }

    const bucket = Math.floor(Date.now() / 60_000);
    await writeEvent({
      eventType: EVENT_TYPES.EXTERNAL_SIGNAL_RECEIVED,
      entityType: "external_signal",
      entityId: signal.id,
      userId: input.userId,
      blueprintId: input.blueprintId,
      payload: {
        signal_id: signal.id,
        source_name: input.sourceName,
        trust_level: trustLevel,
        signal_type: signalType,
      },
      idempotencyKey: `ext_signal:${input.sourceName}:${input.userId}:${bucket}`,
    }).catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), signalId: signal.id },
        "[ExternalSignalGateway] Event emit failed",
      );
    });

    logger.info(
      {
        signalId: signal.id,
        sourceName: input.sourceName,
        trustLevel,
        userId: input.userId,
      },
      "[ExternalSignalGateway] Signal received",
    );

    return { accepted: true, signal_id: signal.id, trust_level: trustLevel };
  }
}

export const externalSignalGateway = new ExternalSignalGateway();

/** @deprecated Prefer ExternalSignalGateway.receive — legacy text-ingest path. */
export type ExternalSignalType = "USER_UPLOAD" | "USER_LINK" | "USER_TEXT" | "SYSTEM_WEBHOOK";

export interface LegacyExternalSignal {
  type: ExternalSignalType;
  content: string;
  metadata?: Record<string, unknown>;
  sourceLabel?: string;
}

export async function ingestSignal(params: {
  userId: string;
  blueprintId: string;
  signal: LegacyExternalSignal;
}): Promise<{ processed: boolean; routedTo: string[] }> {
  const result = await externalSignalGateway.receive({
    userId: params.userId,
    blueprintId: params.blueprintId,
    sourceName: "manual_evidence",
    sourceType: "manual",
    rawPayload: {
      type: params.signal.type,
      content: params.signal.content,
      metadata: params.signal.metadata ?? {},
      source_label: params.signal.sourceLabel,
    },
    signalType: params.signal.type,
  });

  if (!result.accepted) {
    return { processed: false, routedTo: [] };
  }

  const routedTo = ["external_signals"];
  if (params.signal.content.toLowerCase().includes("completed")) {
    routedTo.push("outcome_validation");
  }
  return { processed: true, routedTo };
}
