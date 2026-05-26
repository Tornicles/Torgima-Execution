export type ExternalSystemType =
  | "crm"
  | "hrms"
  | "data_platform"
  | "communication"
  | "custom";

export type ExternalAuthType = "api_key" | "oauth" | "basic";

export interface ExternalCredentials {
  authType?: ExternalAuthType;
  apiKey?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
}

export interface ConnectSystemInput {
  blueprintId: string;
  systemName: string;
  systemType: ExternalSystemType;
  apiEndpoint: string;
  credentials: ExternalCredentials;
  syncFrequency?: string;
}

export interface EncryptedCredentials {
  apiKeyEncrypted: string;
  credentialsEncrypted: string;
}

export interface ConnectionSummary {
  id: string;
  systemName: string;
  systemType: string;
  status: string;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
}

export interface SyncDataResult {
  success: boolean;
  dataSynced?: boolean;
  recordCount?: number;
  externalDataId?: string;
  investigationId?: string;
  error?: string;
}
