import { API_BASE_URL } from "@/lib/api-base";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body.ok) {
    throw new Error(body.error?.message ?? `Admin request failed (${res.status})`);
  }
  return body.data as T;
}

export async function adminLogin(email: string, password: string) {
  return adminFetch<{ email: string }>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function adminLogout() {
  return adminFetch<{ loggedOut: boolean }>("/api/admin/auth/logout", { method: "POST" });
}

export async function adminMe() {
  return adminFetch<{ email: string }>("/api/admin/auth/me");
}

export async function fetchAdminDashboardOverview() {
  return adminFetch<{
    kpis: Record<string, number | string>;
    health: Record<string, unknown>;
    activity: { events: Array<Record<string, unknown>>; recentSignups: Array<Record<string, unknown>> };
    conditions: Array<{ condition: string; count: number }>;
    signups: Array<{ day: string; count: number }>;
  }>("/api/admin/dashboard/overview");
}

export async function fetchAdminUsers(params: { page?: number; search?: string }) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.search) q.set("search", params.search);
  return adminFetch<{ users: Array<Record<string, unknown>>; total: number; page: number }>(
    `/api/admin/users?${q}`,
  );
}

export async function fetchAdminUserDetail(userId: string) {
  return adminFetch<Record<string, unknown>>(`/api/admin/users/${userId}`);
}

export async function fetchAdminSystemHealth() {
  return adminFetch<Record<string, unknown>>("/api/admin/health/system");
}

export async function fetchAdminDeadLetter() {
  return adminFetch<{ events: Array<Record<string, unknown>>; count: number }>(
    "/api/admin/health/dead-letter",
  );
}

export async function fetchAdminAnalytics(days = 30) {
  return adminFetch<Record<string, unknown>>(`/api/admin/analytics/overview?days=${days}`);
}

export async function fetchAdminBhudhi() {
  return adminFetch<Record<string, unknown>>("/api/admin/bhudhi");
}

export async function fetchAdminAudit(page = 1) {
  return adminFetch<{ entries: Array<Record<string, unknown>>; total: number }>(
    `/api/admin/audit?page=${page}`,
  );
}

export async function adminSupportAction(
  action: "unlock" | "task" | "repair" | "message" | "note",
  userId: string,
  body?: Record<string, string>,
) {
  const path =
    action === "note"
      ? `/api/admin/support/note/${userId}`
      : `/api/admin/support/${action}/${userId}`;
  return adminFetch<Record<string, unknown>>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function adminDlqAction(action: "replay" | "dismiss", dlqId: string) {
  return adminFetch<Record<string, unknown>>(`/api/admin/health/dead-letter/${dlqId}/${action}`, {
    method: "POST",
  });
}
