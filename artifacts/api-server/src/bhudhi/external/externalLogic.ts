import { encryptDataBase64, decryptDataBase64 } from "../security/securityLogic.js";
import type { EncryptedCredentials, ExternalCredentials, ExternalSystemType } from "./types.js";

export const EXTERNAL_INVESTIGATION_ENGINE_ID = "inv_data_collection";
export const SYNC_INTERVAL_MS = 60 * 60 * 1000;

export function encryptCredentials(credentials: ExternalCredentials): EncryptedCredentials {
  const serialized = JSON.stringify(credentials);
  return {
    apiKeyEncrypted: encryptDataBase64({
      token: credentials.apiKey ?? credentials.accessToken ?? "",
    }),
    credentialsEncrypted: encryptDataBase64({
      encrypted: true,
      payload: serialized,
      timestamp: new Date().toISOString(),
    }),
  };
}

export function decryptCredentials(apiKeyEncrypted: string | null): ExternalCredentials | null {
  if (!apiKeyEncrypted) return null;
  const decoded = decryptDataBase64(apiKeyEncrypted) as { token?: string } | null;
  return decoded?.token ? { apiKey: decoded.token } : null;
}

export function normalizeExternalData(
  data: Record<string, unknown>,
  systemType: ExternalSystemType,
): Record<string, unknown> {
  return {
    source: systemType,
    timestamp: new Date().toISOString(),
    data,
    normalized: true,
    quality_score: 0.95,
  };
}

export function payloadFromNormalized(normalized: Record<string, unknown>): Record<string, unknown> {
  const inner = normalized["data"];
  if (inner && typeof inner === "object") {
    return inner as Record<string, unknown>;
  }
  return normalized;
}

export function buildAuthHeaders(
  credentials: ExternalCredentials | null,
  apiKeyEncrypted: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(credentials?.headers ?? {}),
  };

  const token =
    credentials?.apiKey ??
    credentials?.accessToken ??
    decryptCredentials(apiKeyEncrypted)?.apiKey;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export function countRecordKeys(data: Record<string, unknown>): number {
  return Object.keys(data).length;
}
