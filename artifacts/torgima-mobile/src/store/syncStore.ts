import { create } from "zustand";

type SyncState = {
  isSyncing: boolean;
  hasUnsynced: boolean;
  unsyncedCount: number;
  lastSuccessfulSync: string | null;
  setSyncing: (v: boolean) => void;
  setPendingCount: (n: number) => void;
  markSynced: () => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  hasUnsynced: false,
  unsyncedCount: 0,
  lastSuccessfulSync: null,
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (unsyncedCount) =>
    set({ unsyncedCount, hasUnsynced: unsyncedCount > 0 }),
  markSynced: () =>
    set({
      hasUnsynced: false,
      unsyncedCount: 0,
      lastSuccessfulSync: new Date().toISOString(),
    }),
}));
