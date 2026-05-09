import { create } from "zustand";

interface BlueprintStore {
  activeBlueprintId: string | null;
  setActiveBlueprintId: (id: string | null) => void;
}

export const useBlueprintStore = create<BlueprintStore>((set) => ({
  activeBlueprintId: null,
  setActiveBlueprintId: (id) => set({ activeBlueprintId: id }),
}));
