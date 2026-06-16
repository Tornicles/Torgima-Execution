/**
 * DOC27 — evidence file storage path builder (Supabase-compatible layout).
 */

import { randomUUID } from "crypto";
import { generateUploadUrl } from "../chat/PersonalChatEngine.js";

export function buildEvidenceStoragePath(
  userId: string,
  blueprintId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `evidence/${userId}/${blueprintId}/${randomUUID()}-${safeName}`;
}

export function storeEvidenceFile(params: {
  userId: string;
  blueprintId: string;
  fileName: string;
  buffer: Buffer;
}): { storagePath: string; publicUrl: string } {
  const storagePath = buildEvidenceStoragePath(params.userId, params.blueprintId, params.fileName);
  const publicUrl = generateUploadUrl(params.userId, "file");
  void params.buffer;
  return { storagePath, publicUrl };
}
