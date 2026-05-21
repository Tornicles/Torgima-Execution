import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type OfflineAction = {
  id: string;
  type: "create" | "update" | "delete";
  resource: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  timestamp: number;
  status: "pending" | "syncing" | "synced" | "failed";
  retryCount: number;
  lastError?: string;
};

let db: SQLite.SQLiteDatabase | null = null;
const WIDGET_CACHE_KEY = "widget_cache_v1";

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function initOfflineDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("torgima.db");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      payload TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);
  return db;
}

export const offlineQueue = {
  async addAction(
    action: Omit<OfflineAction, "id" | "timestamp" | "status" | "retryCount">,
  ): Promise<string> {
    const database = await initOfflineDatabase();
    const id = generateId();
    await database.runAsync(
      `INSERT INTO offline_queue (id, type, resource, resource_id, payload, timestamp, status, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [
        id,
        action.type,
        action.resource,
        action.resourceId ?? null,
        JSON.stringify(action.payload),
        Date.now(),
      ],
    );
    return id;
  },

  async getPendingActions(): Promise<OfflineAction[]> {
    const database = await initOfflineDatabase();
    const rows = await database.getAllAsync<{
      id: string;
      type: string;
      resource: string;
      resource_id: string | null;
      payload: string;
      timestamp: number;
      status: string;
      retry_count: number;
      last_error: string | null;
    }>(`SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY timestamp ASC`);

    return rows.map((row) => ({
      id: row.id,
      type: row.type as OfflineAction["type"],
      resource: row.resource,
      resourceId: row.resource_id ?? undefined,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      timestamp: row.timestamp,
      status: row.status as OfflineAction["status"],
      retryCount: row.retry_count,
      lastError: row.last_error ?? undefined,
    }));
  },

  async markAsSynced(actionId: string) {
    const database = await initOfflineDatabase();
    await database.runAsync(`UPDATE offline_queue SET status = 'synced' WHERE id = ?`, [actionId]);
  },

  async markAsFailed(actionId: string, error: string) {
    const database = await initOfflineDatabase();
    await database.runAsync(
      `UPDATE offline_queue SET status = 'failed', retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
      [error, actionId],
    );
  },

  async pendingCount(): Promise<number> {
    const database = await initOfflineDatabase();
    const row = await database.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM offline_queue WHERE status = 'pending'`,
    );
    return row?.c ?? 0;
  },
};

export async function cacheWidgetData(data: unknown) {
  await AsyncStorage.setItem(WIDGET_CACHE_KEY, JSON.stringify({ data, at: Date.now() }));
}

export async function getCachedWidgetData<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(WIDGET_CACHE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { data: T }).data;
  } catch {
    return null;
  }
}
