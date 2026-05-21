import NetInfo from "@react-native-community/netinfo";
import { api } from "./apiClient";
import { offlineQueue } from "../utils/offlineQueue";
import { useSyncStore } from "../store/syncStore";

class SyncEngine {
  private isSyncing = false;
  private interval: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;

  start() {
    this.unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.isSyncing) {
        void this.syncPendingActions();
      }
    });

    this.interval = setInterval(
      () => {
        void NetInfo.fetch().then((s) => {
          if (s.isConnected && !this.isSyncing) void this.syncPendingActions();
        });
      },
      5 * 60 * 1000,
    );

    void this.syncPendingActions();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async syncPendingActions() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    const { setSyncing, setPendingCount, markSynced } = useSyncStore.getState();
    setSyncing(true);

    try {
      const pending = await offlineQueue.getPendingActions();
      setPendingCount(pending.length);
      if (pending.length === 0) {
        markSynced();
        return;
      }

      const result = await api.post<{
        results: Array<{ clientActionId: string; status: string; error?: string }>;
      }>("/mobile/sync/batch", {
        actions: pending.map((a) => ({
          clientActionId: a.id,
          type: a.type,
          resource: a.resource,
          payload: a.payload,
        })),
      });

      for (const r of result.results) {
        if (r.status === "applied" || r.status === "skipped") {
          await offlineQueue.markAsSynced(r.clientActionId);
        } else if (r.status === "failed") {
          await offlineQueue.markAsFailed(r.clientActionId, r.error ?? "failed");
        }
      }

      const remaining = await offlineQueue.pendingCount();
      setPendingCount(remaining);
      if (remaining === 0) markSynced();
    } finally {
      this.isSyncing = false;
      setSyncing(false);
    }
  }
}

export const syncEngine = new SyncEngine();

export async function submitTaskFeedbackOffline(params: {
  orderId: string;
  blueprintId: string;
  completionStatus: "completed" | "partial" | "failed" | "skipped";
  score?: number;
  feedbackText?: string;
}) {
  const clientActionId = await offlineQueue.addAction({
    type: "create",
    resource: "execution/feedback",
    payload: {
      orderId: params.orderId,
      blueprintId: params.blueprintId,
      completionStatus: params.completionStatus,
      score: params.score,
      feedbackText: params.feedbackText,
    },
  });

  try {
    await api.post("/mobile/quick-feedback", {
      orderId: params.orderId,
      blueprintId: params.blueprintId,
      status: params.completionStatus,
      score: params.score,
      reflection: params.feedbackText,
      idempotencyKey: clientActionId,
    });
    await offlineQueue.markAsSynced(clientActionId);
  } catch {
    void syncEngine.syncPendingActions();
  }
}
