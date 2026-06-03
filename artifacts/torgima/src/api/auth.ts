import { apiRequest } from "./client";
import type { ApiResponse } from "./types";

export type SessionPayload = {
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  userMode?: string;
  userTier?: string;
  user?: Record<string, unknown> | null;
};

export function fetchAuthSession(): Promise<ApiResponse<SessionPayload>> {
  return apiRequest<SessionPayload>("/api/auth/session");
}

export function sendMagicLink(email: string): Promise<ApiResponse<{ sent?: boolean; message?: string }>> {
  return apiRequest("/api/auth/login", { method: "POST", body: { email } });
}

export function verifyMagicLink(
  token: string,
  email: string,
): Promise<ApiResponse<{ user?: Record<string, unknown>; verified?: boolean }>> {
  return apiRequest("/api/auth/verify", { method: "POST", body: { token, email } });
}

export function logout(): Promise<ApiResponse<{ loggedOut?: boolean }>> {
  return apiRequest("/api/auth/logout", { method: "POST", body: {} });
}

export function fetchMe(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest<Record<string, unknown>>("/api/me");
}
