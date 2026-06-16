/**
 * DOC27 Task 2 — file upload and external link processing.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { db, erectorEvidenceLedger } from "@workspace/db";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { evidenceLedgerService } from "../../services/erector/evidence/EvidenceLedgerService.js";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  type UploadContext,
  type UploadFileInput,
  type ExternalLinkInput,
} from "./externalTypes.js";
import {
  canTriggerOutcomeReward,
  scoreExternalTrust,
} from "./ExternalTrustScorer.js";
import { storeEvidenceFile } from "./EvidenceStorage.js";

export type ProcessFileUploadResult =
  | {
      ok: true;
      evidence_id: string;
      trust_level: string;
      evidence_class: string;
      storage_path: string;
    }
  | { ok: false; code: "FILE_TYPE_NOT_ALLOWED" | "FILE_TOO_LARGE" | "PROCESSING_FAILED"; message: string };

export type ProcessExternalLinkResult =
  | { ok: true; evidence_id: string; trust_level: string; evidence_class: string }
  | { ok: false; code: "INVALID_URL" | "PROCESSING_FAILED"; message: string };

export function validateUploadFile(file: Pick<UploadFileInput, "mimeType" | "sizeBytes" | "fileName">): {
  valid: boolean;
  code?: "FILE_TYPE_NOT_ALLOWED" | "FILE_TOO_LARGE";
} {
  const mime = file.mimeType.toLowerCase();
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mime as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
    if (file.fileName.toLowerCase().endsWith(".exe")) {
      return { valid: false, code: "FILE_TYPE_NOT_ALLOWED" };
    }
    return { valid: false, code: "FILE_TYPE_NOT_ALLOWED" };
  }
  if (file.sizeBytes > MAX_UPLOAD_BYTES) {
    return { valid: false, code: "FILE_TOO_LARGE" };
  }
  return { valid: true };
}

async function loadTrustContext(userId: string, blueprintId: string) {
  const since30d = new Date(Date.now() - 30 * 86400000);
  const since7d = new Date(Date.now() - 7 * 86400000);

  const [highEvidenceRow, fabricationRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(erectorEvidenceLedger)
      .where(
        and(
          eq(erectorEvidenceLedger.user_id, userId),
          eq(erectorEvidenceLedger.blueprint_id, blueprintId),
          eq(erectorEvidenceLedger.evidence_strength, "HIGH"),
          gte(erectorEvidenceLedger.created_at, since30d),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(erectorEvidenceLedger)
      .where(
        and(
          eq(erectorEvidenceLedger.user_id, userId),
          eq(erectorEvidenceLedger.blueprint_id, blueprintId),
          sql`${erectorEvidenceLedger.integrity_flags} @> ARRAY['POSSIBLE_FABRICATION']::text[]`,
          gte(erectorEvidenceLedger.created_at, since7d),
        ),
      ),
  ]);

  return {
    userHasHighTrustHistory: (highEvidenceRow[0]?.count ?? 0) > 0,
    possibleFabricationRecent: (fabricationRow[0]?.count ?? 0) > 0,
  };
}

async function countRepeatedUrlSubmissions(userId: string, url: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(erectorEvidenceLedger)
    .where(
      and(
        eq(erectorEvidenceLedger.user_id, userId),
        sql`${erectorEvidenceLedger.content_json}->>'url' = ${url}`,
      ),
    );
  return row?.count ?? 0;
}

export async function processFileUpload(params: {
  userId: string;
  file: UploadFileInput;
  context: UploadContext;
}): Promise<ProcessFileUploadResult> {
  const validation = validateUploadFile(params.file);
  if (!validation.valid) {
    return {
      ok: false,
      code: validation.code ?? "FILE_TYPE_NOT_ALLOWED",
      message:
        validation.code === "FILE_TOO_LARGE"
          ? "File exceeds 10MB limit"
          : "File type is not allowed",
    };
  }

  try {
    const trustContext = await loadTrustContext(params.userId, params.context.blueprintId);
    const trust = scoreExternalTrust({
      sourceType: "user_upload",
      fileType: params.file.mimeType,
      fileSize: params.file.sizeBytes,
      description: params.context.description,
      uploadedBy: params.userId,
      userHasHighTrustHistory: trustContext.userHasHighTrustHistory,
      possibleFabricationRecent: trustContext.possibleFabricationRecent,
    });

    const stored = storeEvidenceFile({
      userId: params.userId,
      blueprintId: params.context.blueprintId,
      fileName: params.file.fileName,
      buffer: params.file.buffer,
    });

    const evidence = await evidenceLedgerService.submit({
      userId: params.userId,
      blueprintId: params.context.blueprintId,
      taskId: params.context.taskId,
      academyTaskId: params.context.academyTaskId,
      sourceType: "user_upload",
      sourceLocation: stored.storagePath,
      contentJson: {
        file_name: params.file.fileName,
        file_type: params.file.mimeType,
        mime_type: params.file.mimeType,
        size_bytes: params.file.sizeBytes,
        description: params.context.description,
        storage_path: stored.storagePath,
        public_url: stored.publicUrl,
        trust_score: trust.score,
      },
      contentSummary: params.context.description?.slice(0, 200),
    });

    await writeEvent({
      eventType: EVENT_TYPES.EXTERNAL_SIGNAL_RECEIVED,
      entityType: "external_signal",
      entityId: evidence.evidence_id,
      userId: params.userId,
      blueprintId: params.context.blueprintId,
      payload: {
        evidence_id: evidence.evidence_id,
        trust_level: trust.level,
        signal_type: "user_upload",
        evidence_class: evidence.evidence_class,
        can_trigger_outcome_reward: canTriggerOutcomeReward(trust.level),
      },
      idempotencyKey: `ext_upload:${params.userId}:${stored.storagePath}`,
    }).catch(() => null);

    return {
      ok: true,
      evidence_id: evidence.evidence_id,
      trust_level: trust.level,
      evidence_class: evidence.evidence_class,
      storage_path: stored.storagePath,
    };
  } catch {
    return { ok: false, code: "PROCESSING_FAILED", message: "Failed to process upload" };
  }
}

export async function processExternalLink(params: {
  userId: string;
  input: ExternalLinkInput;
}): Promise<ProcessExternalLinkResult> {
  try {
    new URL(params.input.url);
  } catch {
    return { ok: false, code: "INVALID_URL", message: "URL is invalid" };
  }

  try {
    const repeatedUrlSubmissions = await countRepeatedUrlSubmissions(params.userId, params.input.url);
    const trust = scoreExternalTrust({
      sourceType: "external_link",
      url: params.input.url,
      description: params.input.description,
      repeatedUrlSubmissions,
    });

    const evidence = await evidenceLedgerService.submit({
      userId: params.userId,
      blueprintId: params.input.blueprintId,
      taskId: params.input.taskId,
      sourceType: "external_link",
      sourceLocation: params.input.url,
      contentJson: {
        url: params.input.url,
        description: params.input.description,
        trust_score: trust.score,
      },
      contentSummary: params.input.description?.slice(0, 200) ?? params.input.url.slice(0, 200),
    });

    await writeEvent({
      eventType: EVENT_TYPES.EXTERNAL_SIGNAL_RECEIVED,
      entityType: "external_signal",
      entityId: evidence.evidence_id,
      userId: params.userId,
      blueprintId: params.input.blueprintId,
      payload: {
        evidence_id: evidence.evidence_id,
        trust_level: trust.level,
        signal_type: "external_link",
        evidence_class: evidence.evidence_class,
        can_trigger_outcome_reward: canTriggerOutcomeReward(trust.level),
      },
      idempotencyKey: `ext_link:${params.userId}:${params.input.url}`,
    }).catch(() => null);

    return {
      ok: true,
      evidence_id: evidence.evidence_id,
      trust_level: trust.level,
      evidence_class: evidence.evidence_class,
    };
  } catch {
    return { ok: false, code: "PROCESSING_FAILED", message: "Failed to process external link" };
  }
}
