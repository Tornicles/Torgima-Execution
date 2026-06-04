import { API_BASE_URL } from "@/config/api";

/** Top-level navigation to Railway — sets session cookie before SPA redirect. */
export function buildApiMagicLinkVerifyUrl(token: string, email: string): string {
  const apiBase = API_BASE_URL.replace(/\/$/, "");
  return `${apiBase}/api/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}
