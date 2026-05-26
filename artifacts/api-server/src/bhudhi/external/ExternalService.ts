import {
  db,
  bhudhiExternalConnections,
  bhudhiExternalData,
  bhudhiInvestigations,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { decryptDataBase64 } from "../security/securityLogic.js";
import {
  buildAuthHeaders,
  countRecordKeys,
  decryptCredentials,
  encryptCredentials,
  EXTERNAL_INVESTIGATION_ENGINE_ID,
  normalizeExternalData,
  payloadFromNormalized,
  SYNC_INTERVAL_MS,
} from "./externalLogic.js";
import { fetchDataBySystemType } from "./externalDataProviders.js";
import {
  extractInsights,
  findAnomalies,
  findPatterns,
} from "./externalAnalysis.js";
import type {
  ConnectSystemInput,
  ConnectionSummary,
  ExternalCredentials,
  SyncDataResult,
} from "./types.js";
import { logger } from "../../lib/logger.js";

export class ExternalService {
  async connectSystem(input: ConnectSystemInput) {
    const encrypted = encryptCredentials(input.credentials);
    const now = new Date();
    const nextSync = new Date(now.getTime() + SYNC_INTERVAL_MS);

    const [connection] = await db
      .insert(bhudhiExternalConnections)
      .values({
        blueprint_id: input.blueprintId,
        system_name: input.systemName,
        system_type: input.systemType,
        api_endpoint: input.apiEndpoint,
        api_key_encrypted: encrypted.apiKeyEncrypted,
        credentials_encrypted: encrypted.credentialsEncrypted,
        sync_frequency: input.syncFrequency ?? "hourly",
        last_sync_at: now,
        next_sync_at: nextSync,
        status: "active",
      })
      .returning();

    const testResult = await this.testConnection(connection!.id);
    if (!testResult.success) {
      await db
        .update(bhudhiExternalConnections)
        .set({
          status: "error",
          error_message: testResult.error ?? "Connection test failed",
          updated_at: new Date(),
        })
        .where(eq(bhudhiExternalConnections.id, connection!.id));

      return testResult;
    }

    return { success: true, connection: this.sanitizeConnection(connection!) };
  }

  async testConnection(connectionId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const connection = await this.getConnectionRow(connectionId);
      if (!connection) return { success: false, error: "Connection not found" };

      const data = await this.fetchData(connection, "test");
      if (!data) return { success: false, error: "Failed to fetch test data" };

      return { success: true, message: "Connection successful" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection test failed";
      return { success: false, error: message };
    }
  }

  async syncData(connectionId: string): Promise<SyncDataResult> {
    const connection = await this.getConnectionRow(connectionId);
    if (!connection || connection.status !== "active") {
      return { success: false, error: "Connection not active" };
    }

    try {
      const raw = await this.fetchDataByType(connection);
      if (!raw) return { success: false, error: "No data fetched" };

      const normalized = normalizeExternalData(
        raw,
        connection.system_type as ConnectSystemInput["systemType"],
      );

      const [stored] = await db
        .insert(bhudhiExternalData)
        .values({
          connection_id: connectionId,
          data_type: connection.system_name,
          raw_data: raw,
          normalized_data: normalized,
          investigation_ids: [],
          insights: [],
        })
        .returning();

      const now = new Date();
      await db
        .update(bhudhiExternalConnections)
        .set({
          last_sync_at: now,
          next_sync_at: new Date(now.getTime() + SYNC_INTERVAL_MS),
          status: "active",
          error_message: null,
          updated_at: now,
        })
        .where(eq(bhudhiExternalConnections.id, connectionId));

      const investigationId = await this.investigateExternalData(
        connection.blueprint_id,
        stored!.id,
        normalized,
      );

      logger.info(
        { connectionId, blueprintId: connection.blueprint_id, investigationId },
        "[External] sync complete",
      );

      return {
        success: true,
        dataSynced: true,
        recordCount: countRecordKeys(raw),
        externalDataId: stored!.id,
        investigationId: investigationId ?? undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await db
        .update(bhudhiExternalConnections)
        .set({
          status: "error",
          error_message: message,
          updated_at: new Date(),
        })
        .where(eq(bhudhiExternalConnections.id, connectionId));

      return { success: false, error: message };
    }
  }

  async pushChanges(
    connectionId: string,
    changes: Record<string, unknown>,
  ): Promise<{ success: boolean; changesPushed?: boolean; result?: unknown; error?: string }> {
    const connection = await this.getConnectionRow(connectionId);
    if (!connection || connection.status !== "active") {
      return { success: false, error: "Connection not active" };
    }

    try {
      const result = await this.sendToExternalSystem(connection, changes);
      return { success: true, changesPushed: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Push failed";
      return { success: false, error: message };
    }
  }

  async getConnections(blueprintId: string): Promise<ConnectionSummary[]> {
    const rows = await db
      .select({
        id: bhudhiExternalConnections.id,
        system_name: bhudhiExternalConnections.system_name,
        system_type: bhudhiExternalConnections.system_type,
        status: bhudhiExternalConnections.status,
        last_sync_at: bhudhiExternalConnections.last_sync_at,
        next_sync_at: bhudhiExternalConnections.next_sync_at,
      })
      .from(bhudhiExternalConnections)
      .where(
        and(
          eq(bhudhiExternalConnections.blueprint_id, blueprintId),
          eq(bhudhiExternalConnections.status, "active"),
        ),
      );

    return rows.map((r) => ({
      id: r.id,
      systemName: r.system_name,
      systemType: r.system_type,
      status: r.status,
      lastSyncAt: r.last_sync_at,
      nextSyncAt: r.next_sync_at,
    }));
  }

  async disconnectSystem(connectionId: string) {
    const [updated] = await db
      .update(bhudhiExternalConnections)
      .set({ status: "inactive", updated_at: new Date() })
      .where(eq(bhudhiExternalConnections.id, connectionId))
      .returning();

    return updated ?? null;
  }

  async getConnectionForBlueprint(connectionId: string, blueprintId: string) {
    const [row] = await db
      .select()
      .from(bhudhiExternalConnections)
      .where(
        and(
          eq(bhudhiExternalConnections.id, connectionId),
          eq(bhudhiExternalConnections.blueprint_id, blueprintId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async getConnectionRow(connectionId: string) {
    const [row] = await db
      .select()
      .from(bhudhiExternalConnections)
      .where(eq(bhudhiExternalConnections.id, connectionId))
      .limit(1);
    return row ?? null;
  }

  private sanitizeConnection(row: typeof bhudhiExternalConnections.$inferSelect) {
    return {
      id: row.id,
      blueprintId: row.blueprint_id,
      systemName: row.system_name,
      systemType: row.system_type,
      apiEndpoint: row.api_endpoint,
      status: row.status,
      syncFrequency: row.sync_frequency,
      lastSyncAt: row.last_sync_at,
      nextSyncAt: row.next_sync_at,
    };
  }

  private parseStoredCredentials(row: typeof bhudhiExternalConnections.$inferSelect): ExternalCredentials | null {
    if (row.credentials_encrypted) {
      const meta = decryptDataBase64(row.credentials_encrypted) as {
        payload?: string;
      } | null;
      if (meta?.payload) {
        try {
          return JSON.parse(meta.payload) as ExternalCredentials;
        } catch {
          /* fall through */
        }
      }
    }
    return decryptCredentials(row.api_key_encrypted);
  }

  private async fetchData(
    connection: typeof bhudhiExternalConnections.$inferSelect,
    _mode: "test" | "sync",
  ): Promise<Record<string, unknown> | null> {
    return this.fetchDataByType(connection);
  }

  private async fetchDataByType(
    connection: typeof bhudhiExternalConnections.$inferSelect,
  ): Promise<Record<string, unknown> | null> {
    const credentials = this.parseStoredCredentials(connection);
    const headers = buildAuthHeaders(credentials, connection.api_key_encrypted);
    return fetchDataBySystemType(
      connection.system_type as ConnectSystemInput["systemType"],
      connection.api_endpoint ?? "",
      headers,
    );
  }

  private async sendToExternalSystem(
    connection: typeof bhudhiExternalConnections.$inferSelect,
    changes: Record<string, unknown>,
  ): Promise<unknown> {
    const endpoint = connection.api_endpoint;
    if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
      return { success: true, mock: true, accepted: changes };
    }

    const credentials = this.parseStoredCredentials(connection);
    const headers = buildAuthHeaders(credentials, connection.api_key_encrypted);

    const response = await fetch(`${endpoint.replace(/\/$/, "")}/updates`, {
      method: "POST",
      headers,
      body: JSON.stringify(changes),
    });

    if (!response.ok) {
      return { success: false, status: response.status };
    }

    try {
      return await response.json();
    } catch {
      return { success: true };
    }
  }

  private async investigateExternalData(
    blueprintId: string,
    externalDataId: string,
    normalized: Record<string, unknown>,
  ): Promise<string | null> {
    const payload = payloadFromNormalized(normalized);
    const patterns = findPatterns(payload);
    const anomalies = findAnomalies(payload);
    const insights = extractInsights(payload);

    const [investigation] = await db
      .insert(bhudhiInvestigations)
      .values({
        blueprint_id: blueprintId,
        engine_id: EXTERNAL_INVESTIGATION_ENGINE_ID,
        subject: "external_system",
        findings: {
          patterns,
          anomalies,
          insights,
          rootCauses: [],
          benchmarks: {},
          externalDataId,
        },
        confidence: 0.85,
        severity: "low",
        actionable: true,
      })
      .returning({ id: bhudhiInvestigations.id });

    await db
      .update(bhudhiExternalData)
      .set({
        investigation_ids: [investigation!.id],
        insights,
        updated_at: new Date(),
      })
      .where(eq(bhudhiExternalData.id, externalDataId));

    return investigation?.id ?? null;
  }

  async listExternalData(connectionId: string, limit = 10) {
    return db
      .select()
      .from(bhudhiExternalData)
      .where(eq(bhudhiExternalData.connection_id, connectionId))
      .orderBy(desc(bhudhiExternalData.created_at))
      .limit(limit);
  }
}

export const externalService = new ExternalService();
