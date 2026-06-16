/**
 * DOC27 Task 4 — webhook verification, duplicate detection, and routing.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, externalSignals, systemHealthLogs } from "@workspace/db";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { evidenceLedgerService } from "../../services/erector/evidence/EvidenceLedgerService.js";
import { APPROVED_WEBHOOK_SOURCES, type ApprovedWebhookSource } from "./externalTypes.js";
import { scoreExternalTrust } from "./ExternalTrustScorer.js";

export type ParsedWebhookSignal = {
  signal_type: "payment_confirmed" | "external_confirmation" | "generic";
  external_id: string;
  userId?: string;
  blueprintId?: string;
  payload: Record<string, unknown>;
};

export type WebhookProcessResult =
  | { ok: true; duplicate?: boolean; evidence_id?: string; routed_events: string[] }
  | { ok: false; status: 401 | 400; code: string; message: string };

export function isApprovedWebhookSource(source: string): source is ApprovedWebhookSource {
  return (APPROVED_WEBHOOK_SOURCES as readonly string[]).includes(source);
}

export function verifyWebhookSignature(
  source: ApprovedWebhookSource,
  payload: unknown,
  signature: string | undefined,
): boolean {
  if (!signature?.trim()) return false;

  const secretEnvKey =
    source === "stripe"
      ? "STRIPE_WEBHOOK_SECRET"
      : source === "github"
        ? "GITHUB_WEBHOOK_SECRET"
        : "CALENDLY_WEBHOOK_SECRET";
  const secret = process.env[secretEnvKey];
  if (!secret?.trim()) {
    return process.env.NODE_ENV !== "production";
  }

  const raw =
    typeof payload === "string"
      ? payload
      : payload instanceof Buffer
        ? payload.toString("utf8")
        : JSON.stringify(payload ?? {});

  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const provided = signature.replace(/^sha256=/, "").trim();
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function parseWebhookPayload(
  source: ApprovedWebhookSource,
  payload: Record<string, unknown>,
): ParsedWebhookSignal | null {
  const externalId =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.external_id === "string"
        ? payload.external_id
        : typeof payload.delivery === "string"
          ? payload.delivery
          : null;

  if (!externalId) return null;

  const metadata =
    payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? (payload.metadata as Record<string, unknown>)
      : {};

  let signal_type: ParsedWebhookSignal["signal_type"] = "generic";
  if (source === "stripe") {
    const type = typeof payload.type === "string" ? payload.type : "";
    if (type.includes("payment") || type.includes("invoice.paid")) {
      signal_type = "payment_confirmed";
    }
  } else if (source === "calendly") {
    signal_type = "external_confirmation";
  } else if (source === "github") {
    signal_type = "external_confirmation";
  }

  return {
    signal_type,
    external_id: externalId,
    userId: typeof metadata.user_id === "string" ? metadata.user_id : undefined,
    blueprintId: typeof metadata.blueprint_id === "string" ? metadata.blueprint_id : undefined,
    payload,
  };
}

export async function checkDuplicateWebhook(source: string, externalId: string): Promise<boolean> {
  const rows = await db
    .select({ id: externalSignals.id, payload: externalSignals.payload })
    .from(externalSignals)
    .where(and(eq(externalSignals.source_name, source)));

  return rows.some((row) => {
    const payload = row.payload as Record<string, unknown>;
    return payload.external_id === externalId;
  });
}

async function writeInvalidSignatureHealthLog(source: string): Promise<void> {
  await db
    .insert(systemHealthLogs)
    .values({
      check_type: "WEBHOOK_SIGNATURE_INVALID",
      status: "OPEN",
      severity: "WARN",
      area: "EXTERNAL_SIGNAL",
      message: `Invalid webhook signature for source ${source}`,
      details_json: { source },
    })
    .catch(() => null);
}

export async function processWebhook(params: {
  source: string;
  payload: Record<string, unknown>;
  signature?: string;
  userId?: string;
  blueprintId?: string;
}): Promise<WebhookProcessResult> {
  if (!isApprovedWebhookSource(params.source)) {
    return { ok: false, status: 401, code: "SOURCE_NOT_APPROVED", message: "Webhook source not approved" };
  }

  const signatureValid = verifyWebhookSignature(
    params.source,
    params.payload,
    params.signature,
  );
  if (!signatureValid) {
    await writeInvalidSignatureHealthLog(params.source);
    return { ok: false, status: 401, code: "WEBHOOK_SIGNATURE_INVALID", message: "Invalid webhook signature" };
  }

  const parsed = parseWebhookPayload(params.source, params.payload);
  if (!parsed) {
    return { ok: false, status: 400, code: "PAYLOAD_SCHEMA_INVALID", message: "Webhook payload schema invalid" };
  }

  if (await checkDuplicateWebhook(params.source, parsed.external_id)) {
    return { ok: true, duplicate: true, routed_events: [] };
  }

  const trust = scoreExternalTrust({
    sourceType: "approved_webhook",
    signatureVerified: true,
    sourceApproved: true,
  });

  const userId = params.userId ?? parsed.userId;
  if (!userId) {
    return { ok: false, status: 400, code: "USER_ID_REQUIRED", message: "user_id is required for webhook routing" };
  }

  const blueprintId = params.blueprintId ?? parsed.blueprintId;
  const routed_events: string[] = [];

  await db
    .insert(externalSignals)
    .values({
      user_id: userId,
      blueprint_id: blueprintId ?? null,
      source_type: "webhook",
      source_name: params.source,
      trust_level: trust.level,
      confidence: trust.score / 100,
      signal_type: parsed.signal_type,
      payload: { ...params.payload, external_id: parsed.external_id },
      normalized_payload: parsed,
      status: "PENDING",
    })
    .catch(() => null);

  let evidence_id: string | undefined;

  if (parsed.signal_type === "payment_confirmed") {
    const evidence = await evidenceLedgerService.submit({
      userId,
      blueprintId,
      sourceType: "payment_signal",
      sourceLocation: params.source,
      contentJson: {
        external_id: parsed.external_id,
        webhook_source: params.source,
        payload: parsed.payload,
        trust_score: trust.score,
      },
      contentSummary: "Payment webhook confirmation",
    });
    evidence_id = evidence.evidence_id;

    await writeEvent({
      eventType: EVENT_TYPES.OUTCOME_VALIDATION_REQUESTED,
      entityType: "external_signal",
      entityId: evidence.evidence_id,
      userId,
      blueprintId,
      payload: {
        evidence_id: evidence.evidence_id,
        source: params.source,
        signal_type: parsed.signal_type,
        trust_level: trust.level,
      },
      idempotencyKey: `outcome_validation:webhook:${params.source}:${parsed.external_id}`,
    }).catch(() => null);
    routed_events.push(EVENT_TYPES.OUTCOME_VALIDATION_REQUESTED);
  } else if (parsed.signal_type === "external_confirmation") {
    await writeEvent({
      eventType: EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED,
      entityType: "external_signal",
      entityId: parsed.external_id,
      userId,
      blueprintId,
      payload: {
        source: params.source,
        signal_type: parsed.signal_type,
        external_id: parsed.external_id,
      },
      idempotencyKey: `dependency_resolution:webhook:${params.source}:${parsed.external_id}`,
    }).catch(() => null);
    routed_events.push(EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED);
  }

  await writeEvent({
    eventType: EVENT_TYPES.EXTERNAL_SIGNAL_RECEIVED,
    entityType: "external_signal",
    entityId: evidence_id ?? parsed.external_id,
    userId,
    blueprintId,
    payload: {
      evidence_id,
      trust_level: trust.level,
      signal_type: "approved_webhook",
      webhook_source: params.source,
      external_id: parsed.external_id,
    },
    idempotencyKey: `ext_webhook:${params.source}:${parsed.external_id}`,
  }).catch(() => null);
  routed_events.push(EVENT_TYPES.EXTERNAL_SIGNAL_RECEIVED);

  return { ok: true, evidence_id, routed_events };
}
