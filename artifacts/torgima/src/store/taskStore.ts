import { create } from "zustand";

interface TaskStore {
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  activeOrderId: null,
  setActiveOrderId: (id) => set({ activeOrderId: id }),
}));
