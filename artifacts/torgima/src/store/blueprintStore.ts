import type { DashboardState } from "@workspace/api-client-react";
import { create } from "zustand";

interface BlueprintStore {
  activeBlueprintId: string | null;
  setActiveBlueprintId: (id: string | null) => void;
  /** Last synced `/api/state/dashboard` payload (polling hook keeps this warm). */
  dashboardProjection: DashboardState | null;
  setDashboardProjection: (projection: DashboardState | null) => void;
}

export const useBlueprintStore = create<BlueprintStore>((set) => ({
  activeBlueprintId: null,
  setActiveBlueprintId: (id) => set({ activeBlueprintId: id }),
  dashboardProjection: null,
  setDashboardProjection: (dashboardProjection) => set({ dashboardProjection }),
}));
