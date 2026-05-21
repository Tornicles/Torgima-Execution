import { create } from "zustand";
import { getAuthToken, setAuthToken } from "../services/apiClient";
import * as authService from "../services/authService";

type User = {
  id: string;
  email: string;
  displayName?: string | null;
};

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  verify: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  hydrate: async () => {
    set({ isLoading: true });
    try {
      const token = await getAuthToken();
      if (!token) {
        set({ isAuthenticated: false, user: null, isLoading: false });
        return;
      }
      const session = await authService.getSession();
      if (session.authenticated && session.user) {
        set({
          isAuthenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email,
            displayName: session.user.display_name ?? session.user.displayName,
          },
          isLoading: false,
        });
      } else {
        await setAuthToken(null);
        set({ isAuthenticated: false, user: null, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },

  sendMagicLink: async (email) => {
    set({ error: null });
    await authService.sendMagicLink(email);
  },

  verify: async (email, token) => {
    set({ error: null, isLoading: true });
    try {
      const result = await authService.verifyMobile(email, token);
      await setAuthToken(result.sessionToken);
      set({
        isAuthenticated: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.display_name ?? result.user.displayName,
        },
        isLoading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Verification failed",
        isLoading: false,
      });
      throw e;
    }
  },

  logout: async () => {
    await authService.logout();
    await setAuthToken(null);
    set({ user: null, isAuthenticated: false });
  },
}));
