/**
 * DOC 31 — authenticated session context (read-only from server).
 */

import { create } from "zustand";

export type SessionContext = {
  userId: string;
  sessionId: string;
  userMode: string;
  userTier: string;
};

interface SessionStore {
  userId: string | null;
  sessionId: string | null;
  userMode: string | null;
  userTier: string | null;
  loaded: boolean;
  setSession: (ctx: SessionContext | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  userId: null,
  sessionId: null,
  userMode: null,
  userTier: null,
  loaded: false,
  setSession: (ctx) =>
    set(
      ctx
        ? {
            userId: ctx.userId,
            sessionId: ctx.sessionId,
            userMode: ctx.userMode,
            userTier: ctx.userTier,
            loaded: true,
          }
        : { userId: null, sessionId: null, userMode: null, userTier: null, loaded: true },
    ),
  clearSession: () =>
    set({
      userId: null,
      sessionId: null,
      userMode: null,
      userTier: null,
      loaded: true,
    }),
}));
