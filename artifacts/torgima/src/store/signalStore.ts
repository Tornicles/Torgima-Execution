import { create } from "zustand";

interface SignalStore {
  lastCondition: string | null;
  setLastCondition: (condition: string) => void;
}

export const useSignalStore = create<SignalStore>((set) => ({
  lastCondition: null,
  setLastCondition: (condition) => set({ lastCondition: condition }),
}));
