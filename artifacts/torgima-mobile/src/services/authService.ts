import { api, apiRequest } from "./apiClient";

export async function sendMagicLink(email: string) {
  return api.post("/auth/send-magic-link", { email });
}

export async function verifyMobile(email: string, token: string) {
  return apiRequest<{
    sessionToken: string;
    user: { id: string; email: string; display_name?: string; displayName?: string };
    authenticated: boolean;
  }>("/mobile/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, token }),
  });
}

export async function getSession() {
  return api.get<{
    authenticated: boolean;
    user: { id: string; email: string; display_name?: string; displayName?: string } | null;
  }>("/auth/session");
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {
    /* ignore */
  }
}
