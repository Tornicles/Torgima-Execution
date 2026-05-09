import { create } from "zustand";

interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  onboardingModalOpen: boolean;
  setOnboardingModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  onboardingModalOpen: false,
  setOnboardingModalOpen: (open) => set({ onboardingModalOpen: open }),
}));
